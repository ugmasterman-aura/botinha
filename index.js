const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do Bot do Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`Bot ligado com sucesso como ${client.user.tag}!`);

  try {
    // Substitui pelo ID do canal de notificações de ovos onde o bot está
    // Podes obter o ID clicando com o botão direito no canal do Discord e escolhendo "Copiar ID"
    const channelId = process.env.CHANNEL_ID; 
    
    if (channelId) {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        console.log('A ler mensagens recentes do canal...');
        const messages = await channel.messages.fetch({ limit: 100 }); // Lê as últimas 100 mensagens

        // Definir o meio-dia de hoje (12:00)
        const hojeMeioDia = new Date();
        hojeMeioDia.setHours(12, 0, 0, 0);

        for (const msg of messages.values()) {
          // Apenas mensagens enviadas a partir do meio-dia de hoje e que tenham embeds
          if (msg.createdAt >= hojeMeioDia && msg.embeds.length > 0) {
            const embed = msg.embeds[0];
            const description = embed.description || '';

            if (description.includes('Egg:') || description.includes('Location:')) {
              const lines = description.split('\n');
              let eggName = 'Desconhecido';
              let location = 'Desconhecida';

              for (const line of lines) {
                if (line.includes('Egg:')) {
                  eggName = line.split('Egg:')[1].trim();
                }
                if (line.includes('Location:')) {
                  location = line.split('Location:')[1].trim();
                }
              }

              // Verificar se já existe na base de dados para não duplicar (opcional, mas útil)
              // Inserir no Supabase (usamos a data exata em que a mensagem foi enviada!)
              const { error } = await supabase
                .from('eggs')
                .insert([{ 
                  egg_name: eggName, 
                  location: location, 
                  spawned_at: msg.createdAt.toISOString() 
                }]);

              if (!error) {
                console.log(`Ovo histórico recuperado: ${eggName} em ${location} (${msg.createdAt.toLocaleTimeString()})`);
              }
            }
          }
        }
        console.log('Varredura de histórico concluída!');
      }
    }
  } catch (err) {
    console.error('Erro ao ler mensagens antigas:', err);
  }
});

// Detetar novas mensagens em tempo real (como antes)
client.on('messageCreate', async (message) => {
  if (message.author.bot && message.embeds.length > 0) {
    const embed = message.embeds[0];
    const description = embed.description || '';
    
    if (description.includes('Egg:') || description.includes('Location:')) {
      const lines = description.split('\n');
      let eggName = 'Desconhecido';
      let location = 'Desconhecida';

      for (const line of lines) {
        if (line.includes('Egg:')) eggName = line.split('Egg:')[1].trim();
        if (line.includes('Location:')) location = line.split('Location:')[1].trim();
      }

      await supabase.from('eggs').insert([{ egg_name: eggName, location: location }]);
    }
    return;
  }

  if (message.content === '!ping') {
    message.reply('Pong! O bot está online e a funcionar.');
  }
});

client.login(process.env.DISCORD_TOKEN);
