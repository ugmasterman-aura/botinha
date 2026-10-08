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
    // Junta todo o texto possível da mensagem (conteúdo, descrição do embed e campos)
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

    // Se a mensagem não tiver menção a "Egg", ignoramos para não sujar a base de dados
    if (!fullText.toLowerCase().includes('egg')) return;

    let eggName = 'Unknown';
    let location = 'Unknown';
    let rarity = 'Common';

    // Extrai o nome do ovo de forma limpa usando Regex (procura por "Egg:" ignorando asteriscos e formatações)
    const eggMatch = fullText.match(/egg\s*[:*_-]*\s*([a-zA-Z0-9_ ]+)/i);
    if (eggMatch && eggMatch[1]) {
      // Limpa espaços extras e formatações
      eggName = eggMatch[1].replace(/[*_`]/g, '').trim().split('\n')[0];
    }

    // Extrai a localização usando Regex
    const locMatch = fullText.match(/location\s*[:*_-]*\s*([a-zA-Z0-9_ ]+)/i);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].replace(/[*_`]/g, '').trim().split('\n')[0];
    }

    // Deteção de Raridade
    const lower = fullText.toLowerCase();
    if (lower.includes('divine') || lower.includes('divino')) rarity = 'Divine';
    else if (lower.includes('secret') || lower.includes('secreto')) rarity = 'Secret';
    else if (lower.includes('mythical') || lower.includes('mítico')) rarity = 'Mythical';
    else if (lower.includes('legendary') || lower.includes('lendário')) rarity = 'Legendary';

    // Substitui espaços por underscores para manter o padrão na BD
    eggName = eggName.replace(/\s+/g, '_');
    location = location.replace(/\s+/g, '_');

    // Se por algum motivo o nome ficou vazio ou estranho, ignoramos
    if (!eggName || eggName === 'Unknown' || eggName.length < 2) return;

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
  console.log(`Bot ligado como ${client.user.tag}! A iniciar varredura completa...`);

  try {
    const channelId = process.env.CHANNEL_ID; 
    if (channelId) {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
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

        console.log('Varredura completa de histórico terminada com sucesso!');
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
