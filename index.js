const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Função para limpar emojis e caracteres indesejados
function cleanText(text) {
  if (!text) return 'Desconhecido';
  // Remove emojis
  let cleaned = text.replace(/[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}]/gu, '');
  // Remove lixo comum de IDs do Discord tipo :1547... ou marcadores de markdown tipo **
  cleaned = cleaned.split(':')[0]; // pega só a primeira parte antes de dois pontos extras se houver
  cleaned = cleaned.replace(/\*\*/g, '').trim();
  return cleaned;
}

async function processMessage(msg) {
  if (msg.embeds && msg.embeds.length > 0) {
    const embed = msg.embeds[0];
    const description = embed.description || '';
    
    if (description.toLowerCase().includes('egg') || description.toLowerCase().includes('location')) {
      const lines = description.split('\n');
      let eggName = 'Desconhecido';
      let location = 'Desconhecida';

      for (const line of lines) {
        if (line.toLowerCase().includes('egg:')) {
          let rawEgg = line.split(':').slice(1).join(':').trim();
          // Remove ID do Discord se vier colado (ex: Egg: Nome:123456)
          rawEgg = rawEgg.split(':')[0]; 
          eggName = cleanText(rawEgg);
        }
        if (line.toLowerCase().includes('location:')) {
          let rawLoc = line.split(':').slice(1).join(':').trim();
          rawLoc = rawLoc.split(':')[0];
          location = cleanText(rawLoc);
        }
      }

      // Ajusta a data para o horário de Brasília (-3 horas em relação ao UTC do servidor)
      const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

      const { error } = await supabase
        .from('eggs')
        .insert([{ 
          egg_name: eggName, 
          location: location, 
          spawned_at: correctedDate.toISOString() 
        }]);

      if (!error) {
        console.log(`Ovo guardado: ${eggName} em ${location}`);
      } else {
        console.error('Erro ao inserir no Supabase:', error);
      }
    }
  }
}

client.once('ready', async () => {
  console.log(`Bot ligado como ${client.user.tag}!`);

  try {
    const channelId = process.env.CHANNEL_ID; 
    if (channelId) {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        console.log('A ler histórico recente do canal...');
        const messages = await channel.messages.fetch({ limit: 50 });

        for (const msg of messages.values()) {
          await processMessage(msg);
        }
        console.log('Varredura de histórico concluída!');
      }
    }
  } catch (err) {
    console.error('Erro ao ler mensagens antigas:', err);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) {
    await processMessage(message);
  }
});

client.login(process.env.DISCORD_TOKEN);
