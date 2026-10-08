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

// Configuração do Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Função inteligente para processar, limpar e salvar a mensagem no Supabase
async function processMessage(msg) {
  try {
    let eggName = 'Unknown_Egg';
    let location = 'Unknown';
    let rarity = 'Common';

    if (msg.embeds && msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      
      if (embed.title) eggName = embed.title;
      else if (embed.description) eggName = embed.description.split('\n')[0];

      // Procura nos campos do embed por Egg, Location e Rarity
      if (embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
          const fieldName = field.name.toLowerCase();
          const fieldValue = field.value;

          if (fieldName.includes('egg') || fieldName.includes('ovo')) {
            eggName = fieldValue;
          }
          if (fieldName.includes('location') || fieldName.includes('local')) {
            location = fieldValue;
          }
          if (fieldName.includes('rarity') || fieldName.includes('raridade')) {
            rarity = fieldValue;
          }
        }
      }
    } else if (msg.content) {
      eggName = msg.content;
    }

    // Limpeza de códigos de emojis feios e espaços
    eggName = eggName.replace(/<a?:\w+:\d+>/g, '').trim().replace(/\s+/g, '_');
    location = location.replace(/<a?:\w+:\d+>/g, '').trim().replace(/\s+/g, '_');

    // Deteção rigorosa de raridade
    const fullText = (eggName + ' ' + location + ' ' + (msg.embeds[0] ? JSON.stringify(msg.embeds[0]) : '')).toLowerCase();
    if (fullText.includes('divine') || fullText.includes('divino')) {
      rarity = 'Divine';
    } else if (fullText.includes('mythical') || fullText.includes('mítico')) {
      rarity = 'Mythical';
    } else if (fullText.includes('legendary') || fullText.includes('lendário')) {
      rarity = 'Legendary';
    } else if (fullText.includes('secret') || fullText.includes('secreto')) {
      rarity = 'Secret';
    }

    // Aplicação do fuso horário (-3h)
    const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

    // Inserção na tabela 'eggs' do Supabase
    const { error } = await supabase
      .from('eggs')
      .insert([
        { 
          egg_name: eggName || 'Unknown', 
          location: location || 'Unknown', 
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

// Evento executado ao ligar (Faz a varredura do histórico até às 12:00)
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

// Inicia o bot
client.login(process.env.DISCORD_TOKEN);
