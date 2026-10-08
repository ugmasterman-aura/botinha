const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Configuração do cliente do Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Configuração do Supabase (utiliza as variáveis de ambiente configuradas no Railway)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Função para processar e salvar a mensagem no Supabase
async function processMessage(msg) {
  try {
    // Verifica se a mensagem tem embeds (geralmente onde vêm os dados dos ovos)
    if (!msg.embeds || msg.embeds.length === 0) return;

    const embed = msg.embeds[0];
    const eggName = embed.title || embed.description || 'Unknown_Egg';
    
    // Tenta extrair a localização se estiver presente no embed ou descrição
    let location = 'Unknown';
    if (embed.fields) {
      const locField = embed.fields.find(f => f.name.toLowerCase().includes('location') || f.name.toLowerCase().includes('local'));
      if (locField) location = locField.value;
    }

    // Deteta a raridade com base no texto do embed
    const textToCheck = (embed.title + ' ' + embed.description + ' ' + (embed.fields ? JSON.stringify(embed.fields) : '')).toLowerCase();
    
    let rarity = 'Common';
    if (textToCheck.includes('divine') || textToCheck.includes('divino')) {
      rarity = 'Divine';
    } else if (textToCheck.includes('mythical') || textToCheck.includes('mítico')) {
      rarity = 'Mythical';
    } else if (textToCheck.includes('legendary') || textToCheck.includes('lendário')) {
      rarity = 'Legendary';
    }

    // Aplica o ajuste de fuso horário (-3h) para a data de criação
    const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

    // Insere os dados na tabela 'eggs' do Supabase incluindo a coluna 'rarity'
    const { error } = await supabase
      .from('eggs')
      .insert([
        { 
          egg_name: eggName.replace(/\s+/g, '_'), 
          location: location.replace(/\s+/g, '_'), 
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

// Evento executado quando o bot fica online (Faz a varredura do histórico até às 12:00)
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

// Evento para capturar novas mensagens em tempo real
client.on('messageCreate', async (message) => {
  if (message.channel.id === process.env.CHANNEL_ID) {
    await processMessage(message);
  }
});

// Inicia o bot com o token configurado no Railway
client.login(process.env.DISCORD_TOKEN);
