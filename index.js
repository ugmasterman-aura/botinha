const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const channelId = process.env.CHANNEL_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const discordToken = process.env.DISCORD_TOKEN;

if (!channelId || !supabaseUrl || !supabaseKey || !discordToken) {
throw new Error('Faltam variáveis de ambiente no Railway.');
}

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const supabase = createClient(supabaseUrl, supabaseKey);

function cleanText(value) {
return String(value || '')
.replace(/<a?:\w+:\d+>/g, '')
.replace(/[*_`~]/g, '')
.trim();
}

function extractField(text, labels) {
for (const line of text.split(/\r?\n/)) {
const colon = line.indexOf(':');
if (colon === -1) continue;

```
const rawLabel = line.slice(0, colon)
  .replace(/^[^\p{L}\p{N}]*/u, '')
  .trim()
  .toLowerCase();

if (labels.some(label => rawLabel === label.toLowerCase())) {
  const value = cleanText(line.slice(colon + 1));
  if (value) return value;
}
```

}

return '';
}

function detectRarity(text) {
if (/\bdivine\b|\bdivino\b|\bdivina\b/i.test(text)) return 'Divine';
if (/\beternal\b|\beterno\b|\beterna\b/i.test(text)) return 'Eternal';
if (/\bsecret\b|\bsecreto\b|\bsecreta\b/i.test(text)) return 'Secret';
return null;
}

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

return new Date(message.createdTimestamp - elapsedMs).toISOString();
}

async function processMessage(message) {
try {
if (message.channelId !== channelId) return;
if (message.author.id === client.user.id) return;
if (!message.embeds || message.embeds.length === 0) return;

```
const embed = message.embeds[0];

const fieldsText = (embed.fields || [])
  .map(field => String(field.name || '') + ': ' + String(field.value || ''))
  .join('\n');

const fullText = [
  embed.title || '',
  embed.description || '',
  fieldsText
].join('\n');

const rarity = detectRarity(fullText);

if (!rarity) {
  console.log('Ignorada: raridade não identificada.');
  return;
}

const eggName = extractField(fullText, ['Egg', 'Ovo']);
const location = extractField(
  fullText,
  ['Location', 'Local', 'Area', 'Área', 'Biome', 'Bioma']
);

if (!eggName || !location) {
  console.log('Notificação incompleta:', {
    title: embed.title,
    description: embed.description,
    fields: fieldsText,
    eggName,
    location
  });
  return;
}

const record = {
  egg_name: eggName,
  location: location,
  spawned_at: getSpawnTime(message, fullText),
  rarity: rarity
};

console.log('Enviando para o Supabase:', record);

const { error } = await supabase
  .from('eggs')
  .insert([record]);

if (error) {
  console.error('Erro no Supabase:', error.message, error.code);
  return;
}

console.log('Registro salvo com sucesso:', eggName);
```

} catch (error) {
console.error('Erro ao processar mensagem:', error);
}
}

client.once('clientReady', () => {
console.log('Bot conectado como ' + client.user.tag);
console.log('Monitorando o canal ' + channelId);
});

client.on('messageCreate', async message => {
if (message.channelId === channelId) {
await processMessage(message);
}
});

client.login(discordToken).catch(error => {
console.error('Erro ao conectar ao Discord:', error);
});
