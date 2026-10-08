const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function processMessage(msg) {
  try {
    let eggName = '';
    let location = '';
    let rarity = 'Common';

    // O bot do SenZ V2 usa embeds com fields
    if (msg.embeds && msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      
      // Analisa o título/descrição para detetar raridade geral
      const metaText = ((embed.title || '') + ' ' + (embed.description || '')).toLowerCase();
      if (metaText.includes('divine') || metaText.includes('divino')) rarity = 'Divine';
      else if (metaText.includes('secret') || metaText.includes('secreto')) rarity = 'Secret';
      else if (metaText.includes('mythical') || metaText.includes('mítico')) rarity = 'Mythical';
      else if (metaText.includes('legendary') || metaText.includes('lendário')) rarity = 'Legendary';

      // Percorre os campos (fields) do embed onde vêm o Egg e a Location
      if (embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
          const fName = field.name.toLowerCase();
          const fVal = field.value || '';

          if (fName.includes('egg') || fVal.toLowerCase().includes('egg')) {
            eggName = fVal;
          }
          if (fName.includes('location') || fName.includes('local') || fVal.toLowerCase().includes('location')) {
            location = fVal;
          }
        }
      }

      // Se não achou nos fields, tenta procurar nas linhas da descrição
      if (!eggName && embed.description) {
        const lines = embed.description.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes('egg')) {
            eggName = line.replace(/egg:?/i, '');
          }
          if (line.toLowerCase().includes('location')) {
            location = line.replace(/location:?/i, '');
          }
        }
      }
    }

    // Se mesmo assim estiver vazio, tenta o conteúdo normal da mensagem
    if (!eggName && msg.content) {
      eggName = msg.content;
    }

    if (!eggName) return; // Ignora se não encontrar nenhum ovo válido

    // Limpeza profunda de asteriscos, emojis do Discord, tags HTML e espaços
    const cleanText = (text) => {
      return text
        .replace(/<a?:\w+:\d+>/g, '')      // Remove emojis customizados do Discord
        .replace(/[*_`~]/g, '')            // Remove formatações Markdown (*, _, `, ~)
        .replace(/egg:?/gi, '')            // Remove a palavra "Egg" se sobrou
        .replace(/location:?/gi, '')       // Remove a palavra "Location" se sobrou
        .trim()
        .replace(/\s+/g, '_');             // Substitui espaços por underscores
    };

    eggName = cleanText(eggName);
    location = location ? cleanText(location) : 'Unknown';

    if (!eggName || eggName === '_') return;

    // Aplica o fuso horário (-3h)
    const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

    // Insere no Supabase
    const { error } = await supabase
      .from('eggs')
      .insert([
        { 
          egg_name: eggName, 
          location: location, 
          rarity: rarity,
          spawned_at: correctedDate.toISOString()
        }
      ]);

    if (error) {
      console.error('Erro ao inserir no Supabase:', error.message);
    }
  } catch (err) {
    console.error('Erro no processamento da mensagem:', err);
  }
}

client.once('ready', async () => {
  console.log(`Bot ligado como ${client.user.tag}!`);

  try {
    const channelId = process.env.CHANNEL_ID; 
    if (channelId) {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        console.log('A ler histórico completo desde as 12:00...');
        
        let lastId = null;
        let reachedTargetTime = false;
        
        const now = new Date();
        const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        
        while (!reachedTargetTime) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) break;

          for (const msg of messages.values()) {
            const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

            await processMessage(msg);

            if (correctedDate < targetDate) {
              reachedTargetTime = true;
              break;
            }
          }

          if (reachedTargetTime) break;

          lastId = messages.last().id;

          if (messages.size < 100) break;
        }

        console.log('Varredura de histórico até às 12:00 concluída com sucesso!');
      }
    }
  } catch (err) {
    console.error('Erro ao ler mensagens antigas:', err);
  }
});

client.on('messageCreate', async (message) => {
  if (message.channel.id === process.env.CHANNEL_ID) {
    await processMessage(message);
  }
});

client.login(process.env.DISCORD_TOKEN);
