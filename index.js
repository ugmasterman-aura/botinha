console.log('A ler histórico completo até às 12:00...');
let lastId = null;
let fetching = true;

while (fetching) {
  const options = { limit: 100 };
  if (lastId) options.before = lastId;

  const messages = await channel.messages.fetch(options);
  if (messages.size === 0) break;

  for (const msg of messages.values()) {
    // Ajusta a data para o horário de Brasília (-3h)
    const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));
    
    // Processa a mensagem
    await processMessage(msg);

    // Se a mensagem já for anterior a hoje às 12:00, podemos parar
    const today12 = new Date();
    today12.setHours(12, 0, 0, 0);

    if (correctedDate < today12) {
      fetching = false;
    }
  }

  // Atualiza o ID da última mensagem para o próximo lote
  lastId = messages.last().id;

  // Segurança para evitar loops infinitos caso haja muitas mensagens
  if (messages.size < 100) break;
}
console.log('Varredura de histórico até às 12:00 concluída!');
