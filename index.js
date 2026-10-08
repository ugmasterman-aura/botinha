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
    if (!msg.embeds || msg.embeds.length === 0) return;

    const embed = msg.embeds[0];
    
    // Pega o título ou descrição tal como tinhas antes (que funcionava bem)
    let eggName = embed.title || embed.description || 'Unknown_Egg';
    
    let location = 'Unknown';
    if (embed.fields) {
      const locField = embed.fields.find(f => f.name.toLowerCase().includes('location') || f.name.toLowerCase().includes('local'));
      if (locField) location = locField.value;
    }

    // Deteta a raridade com base em todo o conteúdo do embed
    const textToCheck = (embed.title + ' ' + embed.description + ' ' + (embed.fields ? JSON.stringify(embed.fields) : '')).toLowerCase();
    
    let rarity = 'Common';
    if (textToCheck.includes('divine') || textToCheck.includes('divino')) {
      rarity = 'Divine';
    } else if (textToCheck.includes('secret') || textToCheck.includes('secreto')) {
      rarity = 'Secret';
    } else if (textToCheck.includes('mythical') || textToCheck.includes('mítico')) {
      rarity = 'Mythical';
    } else if (textToCheck.includes('legendary') || textToCheck.includes('lendário')) {
      rarity = 'Legendary';
    }

    // Limpa apenas os emojis do Discord (ex: <:Yeti:15470911...> vira só o texto ou limpa o lixo)
    eggName = eggName.replace(/<a?:\w+:\d+>/g, '').trim().replace(/\s+/g, '_');
    location = location.replace(/<a?:\w+:\d+>/g, '').trim().replace(/\s+/g, '_');

    // Se o nome ficou vazio após a limpeza, ignoramos
    if (!eggName || eggName === '_') return;

    // Aplica a correção de fuso horário (-3h)
    const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

    // Insere no Supabase com a coluna rarity incluída
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
  console.log(`Bot ligado como ${client.user.tag}! A ler histórico...`);

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

        console.log('Varredura concluída com sucesso!');
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
