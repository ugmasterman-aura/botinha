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
    let fullText = '';
    let embedTitle = '';
    let embedDesc = '';
    let fields = [];

    if (msg.embeds && msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      embedTitle = embed.title || '';
      embedDesc = embed.description || '';
      if (embed.fields) fields = embed.fields;
      
      fullText = (embedTitle + ' ' + embedDesc + ' ' + JSON.stringify(fields)).toLowerCase();
    } else if (msg.content) {
      fullText = msg.content.toLowerCase();
    }

    // 1. FILTROS RIGOROSOS: Ignora Lab Tracker, alertas de atividade e os banners genéricos "_Spawned!!"
    if (
      fullText.includes('lab tracker') || 
      fullText.includes('is active') || 
      fullText.includes('_spawned') || 
      fullText.includes('spawned!!') || 
      !fullText.includes('egg')
    ) {
      return; 
    }

    let eggName = '';
    let location = 'Unknown';
    let rarity = 'Common';

    // 2. EXTRAÇÃO DOS CAMPOS DO EMBED
    if (fields.length > 0) {
      for (const field of fields) {
        const fName = field.name.toLowerCase();
        const fVal = field.value || '';

        if (fName.includes('egg') || fName.includes('ovo')) {
          eggName = fVal;
        } else if (fName.includes('location') || fName.includes('local')) {
          location = fVal;
        }
      }
    }

    // Se não encontrou nos fields, procura na descrição
    if (!eggName && embedDesc) {
      const lines = embedDesc.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes('egg:')) {
          eggName = line.replace(/.*egg:\s*/i, '');
        } else if (line.toLowerCase().includes('location:')) {
          location = line.replace(/.*location:\s*/i, '');
        }
      }
    }

    if (!eggName && embedTitle) {
      eggName = embedTitle;
    }

    if (!eggName) return;

    // 3. DETEÇÃO DE RARIDADE ROBUSTA
    if (fullText.includes('divine') || fullText.includes('divino')) {
      rarity = 'Divine';
    } else if (fullText.includes('eternal') || fullText.includes('eterno') || eggName.toLowerCase().includes('eternal')) {
      rarity = 'Eternal';
    } else if (fullText.includes('secret') || fullText.includes('secreto') || eggName.toLowerCase().includes('secret')) {
      rarity = 'Secret';
    } else if (fullText.includes('mythical') || fullText.includes('mítico')) {
      rarity = 'Mythical';
    } else if (fullText.includes('legendary') || fullText.includes('lendário')) {
      rarity = 'Legendary';
    }

    // 4. LIMPEZA PROFUNDA DE EMOJIS E MARKDOWN
    const cleanText = (text) => {
      return text
        .replace(/<a?:\w+:\d+>/g, '')      // Remove emojis do Discord
        .replace(/[*_`~<>]/g, '')          // Remove formatações Markdown
        .replace(/egg:?/gi, '')            // Remove palavra egg se sobrar
        .replace(/location:?/gi, '')       // Remove palavra location se sobrar
        .trim()
        .replace(/\s+/g, '_');             // Substitui espaços por underscores
    };

    eggName = cleanText(eggName);
    location = cleanText(location);

    if (!eggName || eggName === '_') return;

    // Fuso horário (-3h)
    const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

    // Insere no Supabase apenas dados limpos e válidos
    const { error } = await supabase
      .from('eggs')
      .insert([
        { 
          egg_name: eggName, 
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

client.once('ready', async () => {
  console.log(`Bot ligado como ${client.user.tag}! A ler histórico limpo...`);

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
