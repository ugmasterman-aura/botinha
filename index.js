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
    let embedTitle = '';
    let embedDesc = '';
    let fields = [];

    // Garante que só processamos mensagens que tenham embeds (o formato padrão do bot de ovos)
    if (!msg.embeds || msg.embeds.length === 0) return;

    const embed = msg.embeds[0];
    embedTitle = embed.title || '';
    embedDesc = embed.description || '';
    if (embed.fields) fields = embed.fields;

    const fullText = (embedTitle + ' ' + embedDesc + ' ' + JSON.stringify(fields)).toLowerCase();

    // Filtros de ruído: ignora lab, laboratório, eventos de atividade e alertas genéricos do sistema
    if (
      fullText.includes('lab') || 
      fullText.includes('experimental') || 
      fullText.includes('is active') || 
      fullText.includes('alert') || 
      fullText.includes('spawned!!') ||
      !fullText.includes('egg')
    ) {
      return; 
    }

    let eggName = '';
    let location = 'Unknown';
    let rarity = 'Common';

    // Procura o nome do ovo e a localização diretamente nos campos estruturados (fields)
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

    // Se não veio nos fields, tenta extrair da descrição
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

    // Determina a raridade exata com base no texto do embed
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

    // Limpeza de emojis e formatações indesejadas para o nome e local ficarem limpos (ex: Gargoyle, Demons)
    const cleanText = (text) => {
      return text
        .replace(/<a?:\w+:\d+>/g, '')      // Remove emojis do Discord
        .replace(/[*_`~<>]/g, '')          // Remove formatações Markdown
        .replace(/egg:?/gi, '')            // Remove palavra egg se sobrar
        .replace(/location:?/gi, '')       // Remove palavra location se sobrar
        .trim();
    };

    eggName = cleanText(eggName);
    location = cleanText(location);

    if (!eggName || eggName.length < 2) return;

    // Fuso horário (-3h) aplicado exatamente ao horário do Discord
    const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

    // Insere os dados limpos no Supabase
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
  console.log(`Bot ligado como ${client.user.tag}! A carregar o histórico completo...`);

  try {
    const channelId = process.env.CHANNEL_ID; 
    if (channelId) {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        let lastId = null;
        let fetchedCount = 0;
        let keepFetching = true;
        
        // Puxa o histórico em massa para trás para preencher a tabela com os ovos anteriores
        while (keepFetching && fetchedCount < 2000) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) break;

          for (const msg of messages.values()) {
            await processMessage(msg);
            fetchedCount++;
          }

          lastId = messages.last().id;

          if (messages.size < 100) {
            keepFetching = false;
          }
        }

        console.log(`Histórico carregado! Total de mensagens processadas: ${fetchedCount}`);
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
