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

client.once('ready', () => {
  console.log(`Bot ligado com sucesso como ${client.user.tag}!`);
});

// Detetar mensagens e embeds de ovos
client.on('messageCreate', async (message) => {
  if (message.author.bot) {
    // Verificar se a mensagem tem embeds (como as notificações do bot de ovos)
    if (message.embeds.length > 0) {
      const embed = message.embeds[0];
      const description = embed.description || '';
      
      // Procurar por linhas que contenham o nome do ovo e a localização no embed
      if (description.includes('Egg:') || description.includes('Location:')) {
        try {
          // Extrair informações básicas do texto do embed
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

          // Guardar na tabela 'eggs' do Supabase
          const { error } = await supabase
            .from('eggs')
            .insert([{ egg_name: eggName, location: location }]);

          if (error) {
            console.error('Erro ao guardar no Supabase:', error);
          } else {
            console.log(`Ovo guardado com sucesso: ${eggName} em ${location}`);
          }
        } catch (err) {
          console.error('Erro ao processar o embed:', err);
        }
      }
    }
    return;
  }

  // Comando de teste antigo
  if (message.content === '!ping') {
    message.reply('Pong! O bot está online e a funcionar.');
  }
});

client.login(process.env.DISCORD_TOKEN);
