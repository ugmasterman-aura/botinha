const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const channelId = process.env.CHANNEL_ID;

if (!supabaseUrl || !supabaseKey || !process.env.DISCORD_TOKEN || !channelId) {
throw new Error(
'Configure DISCORD_TOKEN, CHANNEL_ID, SUPABASE_URL e SUPABASE_KEY no Railway.'
);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function cleanText(text = '') {
return text
.replace(/<a?:\w+:\d+>/g, '')
.replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
.replace(/<t:(\d+)(?::[tTdDfFR])?>/g, '$1')
.replace(/[*_`~]/g, '')
.trim();
}

function extractValue(text, label) {
const regex = new RegExp(
`(?:^|\\n)\\s*(?:[^\\S\\n]*)(?:[^\\w\\n]*\\s*)?${label}\\s*:\\s*([^\\n]+)`,
'im'
);

const match = text.match(regex);
return match ? cleanText(match[1]) : '';
}

function detectRarity(text) {
if (/\bdivine\b|\bdivino\b|\bdivina\b/i.test(text)) return 'Divine';
if (/\beternal\b|\beterno\b|\beterna\b/i.test(text)) return 'Eternal';
if (/\bsecret\b|\bsecreto\b|\bsecreta\b/i.test(text)) return 'Secret';
return null;
}

function estimateSpawnTime(message, fullText) {
// A idade relativa do embed é a melhor pista disponível
// para estimar quando o pet apareceu.
const ageMatch = fullText.match(
/(?:spawned\s*:\s*)?(?:há|ha|about|around)?\s*(\d+)\s*(seconds?|secs?|segundos?|minutes?|mins?|minutos?|hours?|hrs?|horas?)\b/i
);

let elapsedMs = 0;

if (ageMatch) {
const amount = Number(ageMatch[1]);
const unit = ageMatch[2].toLowerCase();

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

// Mantém a data em UTC. Não subtraia três horas manualmente.
return new Date(message.createdTimestamp - elapsedMs).toISOString();
}

async function processMessage(message) {
try {
if (message.channelId !== channelId) return;
if (!message.embeds.length) return;

```
const embed = message.embeds[0];

// Alguns notificadores colocam os dados na descrição;
// outros usam campos separados.
const fieldText = (embed.fields || [])
  .map(field => `${field.name}: ${field.value}`)
  .join('\n');

const fullText = [
  embed.title || '',
  embed.description || '',
  fieldText
].join('\n');

const rarity = detectRarity(fullText);

// Só registrar as três raridades desejadas.
if (!rarity) {
  console.log('Ignorada: raridade não identificada.');
  return;
}

const eggName = extractValue(fullText, 'Egg|Ovo');
const location = extractValue(fullText, 'Location|Local|Area|Área|Biome|Bioma');

if (!eggName || !location) {
  console.log('Notificação ignorada: dados incompletos.', {
    title: embed.title,
    eggName,
    location,
    description: embed.description
  });
  return;
}

const spawnedAt = estimateSpawnTime(message, fullText);

const record = {
  egg_name: eggName,
  location,
  spawned_at: spawnedAt,
  rarity
};

console.log('Notificação identificada:', record);

const { data, error } = await supabase
  .from('eggs')
  .insert(record)
  .select();

if (error) {
  console.error('Erro ao inserir no Supabase:', error);
  return;
}

console.log('Registro salvo com sucesso:', data);
```

} catch (error) {
console.error('Erro ao processar notificação:', error);
}
}

client.once('clientReady', () => {
console.log(`Bot conectado como ${client.user.tag}`);
console.log(`Monitorando o canal ${channelId}`);
});

client.on('messageCreate', async message => {
if (message.channelId !== channelId) return;

// O bot também consegue ler embeds enviados por outros bots,
// desde que tenha acesso ao canal e as permissões necessárias.
if (message.author.id === client.user.id) return;

await processMessage(message);
});

client.login(process.env.DISCORD_TOKEN);
