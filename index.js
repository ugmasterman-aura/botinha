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
    let eggName = 'Unknown_Egg';
    let location = 'Unknown';
    let rarity = 'Common';

    // Junta o conteúdo da mensagem e todos os textos dos embeds para analisar de forma global
    let fullText = msg.content || '';
    if (msg.embeds && msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      if (embed.title) fullText += '\n' + embed.title;
      if (embed.description) fullText += '\n' + embed.description;
      if (embed.fields) {
        embed.fields.forEach(f => {
          fullText += '\n' + f.name + ': ' + f.value;
        });
      }
    }

    // Extrai o Egg com base no padrão "Egg: [Nome]"
    const eggMatch = fullText.match(/Egg:\s*([^\n]+)/i);
    if (eggMatch && eggMatch[1]) {
      eggName = eggMatch[1].trim();
    }

    // Extrai a Location com base no padrão "Location: [Local]"
    const locMatch = fullText.match(/Location:\s*([^\n]+)/i);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].trim();
    }

    // Define a raridade com base no título ou conteúdo geral (ex: Secret Egg, Divine, etc.)
    const lowerText = fullText.toLowerCase();
    if (lowerText.includes('divine') || lowerText.includes('divino')) {
      rarity = 'Divine';
    } else if (lowerText.includes('secret') || lowerText.includes('secreto')) {
      rarity = 'Secret';
    } else if (lowerText.includes('mythical') || lowerText.includes('mítico')) {
      rarity = 'Mythical';
    } else if (lowerText.includes('legendary') || lowerText.includes('lendário')) {
      rarity = 'Legendary';
    }

    // Limpeza de emojis e substituição de espaços por underscores para manter o padrão
    eggName = eggName.replace(/<a?:\w+:\d+>/g, '').trim().replace(/\s+/g, '_');
    location = location.replace(/<a?:\w+:\d+>/g, '').trim().replace(/\s+/g, '_');

    // Se por acaso não encontrou o ovo estruturado, ignora mensagens irrelevantes
    if (eggName === 'Unknown_Egg') return;

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
