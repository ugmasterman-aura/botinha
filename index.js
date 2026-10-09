const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Discord
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const channelId = process.env.CHANNEL_ID;

if (!supabaseUrl || !supabaseKey || !channelId || !process.env.DISCORD_TOKEN) {
throw new Error(
'Faltam variáveis: DISCORD_TOKEN, CHANNEL_ID, SUPABASE_URL ou SUPABASE_KEY.'
);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Remove formatação e emojis sem alterar os dados importantes
function cleanText(value) {
return String(value || '')
.replace(/<a?:\w+:\d+>/g, '')
.replace(/[*_`~]/g, '')
.trim();
}

// Extrai um valor de uma linha, como Egg: Mosasaurus
function extractField(text, labels) {
const lines = text.split(/\r?\n/);

for (const line of lines) {
for (const label of labels) {
const pattern = new RegExp(
'^\s*[^\w\n]*\s*' + label + '\s*:\s*(.*?)\s*$',
'i'
);

```
  const match = line.match(pattern);

  if (match && match[1]) {
    return cleanText(match[1]);
  }
}
```

}

return '';
}

// Identifica somente as raridades que queremos monitorar
function detectRarity(text) {
if (/\bdivine\b|\bdivino\b|\bdivina\b/i.test(text)) {
return 'Divine';
}

if (/\beternal\b|\beterno\b|\beterna\b/i.test(text)) {
return 'Eternal';
}

if (/\bsecret\b|\bsecreto\b|\bsecreta\b/i.test(text)) {
return 'Secret';
}

return null;
}

// Estima o horário do spawn usando a idade indicada no embed
function getSpawnTime(message, text) {
const match = text.match(
/(?:spawned\s*:\s*)?(?:há|ha|about|around)?\s*(\d+)\s*(seconds?|secs?|segundos?|minutes?|mins?|minutos?|hours?|hrs?|horas?)\b/i
);

let elapsedMs = 0;

if (match) {
const amount = Number(match[1]);
const unit = match[2].toLowerCase();

```
if (/second|sec|segundo/.test(unit)) {
  elapsedMs = amount * 1000;
} else if (/minute|min|minuto/.test(unit)) {
  elapsedMs = amount * 60 * 1000;
} else if (/hour|hr|hora/.test(unit)) {
  elapsedMs = amount * 60 * 60 * 1000;
}
```

}

// Guarda a data em UTC, sem subtrair horas manualmente
return new Date(message.createdTimestamp - elapsedMs).toISOString();
}

// Processa uma notificação do Discord
async function processMessage(message) {
try {
if (message.channelId !== channelId) return;
if (message.author.id === client.user.id) return;
if (!message.embeds || message.embeds.length === 0) return;

```
const embed = message.embeds[0];

const fieldsText = (embed.fields || [])
  .map(function (field) {
    return String(field.name || '') + ': ' + String(field.value || '');
  })
  .join('\n');

const fullText = [
  embed.title || '',
  embed.description || '',
  fieldsText
].join('\n');

const rarity = detectRarity(fullText);

if (!rarity) {
  console.log('Notificação ignorada: não é Secret, Eternal ou Divine.');
  return;
}

const eggName = extractField(fullText, ['Egg', 'Ovo']);
const location = extractField(
  fullText,
  ['Location', 'Local', 'Area', 'Área', 'Biome', 'Bioma']
);

if (!eggName || !location) {
  console.log('Notificação incompleta. Verifique o formato do embed.');
  console.log('Título:', embed.title || '(sem título)');
  console.log('Descrição:', embed.description || '(sem descrição)');
  console.log('Campos:', fieldsText || '(sem campos)');
  return;
}

const record = {
  egg_name: eggName,
  location: location,
  spawned_at: getSpawnTime(message, fullText),
  rarity: rarity
};

console.log('Enviando registro:', record);

const result = await supabase
  .from('eggs')
  .insert([record]);

if (result.error) {
  console.error('Erro ao salvar no Supabase:', result.error.message);
  console.error('Código:', result.error.code);
  return;
}

console.log('Registro salvo com sucesso:', eggName);
```

} catch (error) {
console.error('Erro ao processar mensagem:', error);
}
}

// Inicialização do bot
client.once('clientReady', function () {
console.log('Bot conectado como ' + client.user.tag);
console.log('Monitorando o canal ' + channelId);
});

// Recebe novas mensagens em tempo real
client.on('messageCreate', async function (message) {
if (message.channelId !== channelId) return;

await processMessage(message);
});

// Conecta ao Discord
client.login(process.env.DISCORD_TOKEN).catch(function (error) {
console.error('Erro ao conectar ao Discord:', error);
});
