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
        
        // Define o horário alvo de hoje às 12:00 (ajustado para UTC considerando o -3h, ou seja, 15:00 UTC)
        // Como o msg.createdAt é UTC, vamos calcular o limite exato:
        const now = new Date();
        const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        // Adiciona 3 horas para equiparar ao UTC do Discord se necessário, 
        // mas comparando diretamente com a data já tratada ou com margem de segurança:
        
        while (!reachedTargetTime) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) break;

          for (const msg of messages.values()) {
            // Aplica a mesma correção de fuso (-3h)
            const correctedDate = new Date(msg.createdAt.getTime() - (3 * 60 * 60 * 1000));

            // Processa a mensagem normalmente
            await processMessage(msg);

            // Se a mensagem já for anterior às 12:00 de hoje, ativamos a bandeira para parar
            if (correctedDate < targetDate) {
              reachedTargetTime = true;
              break;
            }
          }

          if (reachedTargetTime) break;

          // Pega o ID da última mensagem deste lote para buscar o lote anterior
          lastId = messages.last().id;

          // Trava de segurança para evitar loop infinito caso o canal acabe
          if (messages.size < 100) break;
        }

        console.log('Varredura de histórico até às 12:00 concluída com sucesso!');
      }
    }
  } catch (err) {
    console.error('Erro ao ler mensagens antigas:', err);
  }
});
