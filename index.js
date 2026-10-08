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

// Função para processar e guardar o ovo
async function processMessage(msg) {
  if (msg.embeds && msg.embeds.length > 0) {
    const embed = msg.embeds[0];
    const description = embed.description || '';
    
    // Verifica se contém Egg ou Location (ignorando emojis ou variações)
    if (description.toLowerCase().includes('egg') || description.toLowerCase().includes('location')) {
      const lines = description.split('\n');
      let eggName = 'Desconhecido';
      let location = 'Desconhecida';

      for (const line of lines) {
        if (line.toLowerCase().includes('egg:')) {
          eggName = line.split(':').slice(1).join(':').trim();
          // Remove emojis se houver no nome
          eggName = eggName.replace(/[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
        }
        if (line.toLowerCase().includes('location:')) {
          location = line.split(':').slice(1).join(':').trim();
          location = location.replace(/[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
        }
      }

      // Insere no Supabase com a data da mensagem
      const { error } = await supabase
        .from('eggs')
        .insert([{ 
          egg_name: eggName, 
          location: location, 
          spawned_at: msg.createdAt.toISOString() 
        }]);

      if (!error) {
        console.log(`Ovo guardado: ${eggName} em ${location} (${msg.createdAt.toLocaleTimeString()})`);
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

// Ouve novas mensagens em tempo real
client.on('messageCreate', async (message) => {
  if (message.author.bot) {
    await processMessage(message);
  }
  
  if (message.content === '!ping') {
    message.reply('Pong! O bot está online.');
  }
});

client.login(process.env.DISCORD_TOKEN);
