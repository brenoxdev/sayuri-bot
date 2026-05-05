import {
    initRAG,
    addRules,
    addFAQ,
    addDocument,
    indexChannelMessages,
    getRAGStats
  } from '../utils/rag.js';
  
  const CHANNELS_TO_INDEX = [
    '1497456609947811932', // MAIN
    '1497456270377226360', // SUPPORT
    '1429652453078597733', // CHAT
    '1497455959251877938', // BRAIN
  ];
  
  const SERVER_RULES = `
  REGRAS DO SERVIDOR:
  1. Respeite todos os membros
  2. Sem spam ou flood
  3. Sem conteúdo NSFW fora dos canais apropriados
  4. Sem divulgação de outros servidores sem permissão
  5. Siga as diretrizes do Discord
  6. Admins e moderadores têm palavra final
  
  INFORMAÇÕES DO SERVIDOR:
  - Sayuri é a IA assistente do servidor
  - Yuzy é o admin do servidor
  - Brenox é o criador da Sayuri
  - Canal #sms: conversa principal
  - Canal #jogos-gratis: jogos gratuitos
  - Canal #live-on: notificações de live
  `;
  
  const SERVER_FAQS = [
    { q: 'Como ganhar cargos?', a: 'Você ganha cargos ao subir de nível! Níveis 5, 10, 20 e 50 dão cargos especiais.' },
    { q: 'Como tocar música?', a: 'Use !play <nome ou URL> para tocar músicas do YouTube ou Spotify.' },
    { q: 'Como falar com a Sayuri?', a: 'Mencione Sayuri em qualquer mensagem! Exemplo: "Sayuri, tudo bem?"' },
    { q: 'Quando o Yu vai fazer live?', a: 'A Sayuri avisa automaticamente no canal live-on quando o Yu entrar ao vivo!' },
    { q: 'Quem é o Yuzy?', a: 'Yuzy é o admin do servidor, tratado com muito respeito e carinho pela Sayuri.' },
    { q: 'Quem é o Brenox?', a: 'Brenox é o criador da Sayuri e dono do servidor.' },
  ];
  
  export async function setupRAG(client) {
    await initRAG();
  
    const stats = await getRAGStats();
    console.log(`[RAG] Base atual: ${stats.totalVectors} vetores | Status: ${stats.status}`);
  
    if (stats.status === 'offline') return;
  
    // Se base vazia, alimenta com conhecimento inicial
    if (stats.totalVectors === 0) {
      console.log('[RAG] Base vazia! Alimentando conhecimento inicial...');
  
      await addRules(SERVER_RULES);
  
      for (const faq of SERVER_FAQS) {
        await addFAQ(faq.q, faq.a);
        await new Promise(res => setTimeout(res, 200));
      }
  
      // Indexa histórico dos canais
      for (const channelId of CHANNELS_TO_INDEX) {
        await indexChannelMessages(client, channelId, 100);
        await new Promise(res => setTimeout(res, 1000));
      }
  
      console.log('[RAG] ✅ Base de conhecimento inicial criada!');
    }
  
    // Atualiza base a cada hora
    setInterval(async () => {
      console.log('[RAG] Atualizando base...');
      for (const channelId of CHANNELS_TO_INDEX) {
        await indexChannelMessages(client, channelId, 30);
        await new Promise(res => setTimeout(res, 500));
      }
    }, 60 * 60 * 1000);
  
    // Comandos admin no canal do cérebro
    client.on('messageCreate', async (msg) => {
      if (msg.channelId !== process.env.BRAIN_CHANNEL_ID) return;
      if (!['391690768512974859', '672309902076805132'].includes(msg.author.id)) return;
  
      if (msg.content === '!rag stats') {
        const s = await getRAGStats();
        await msg.reply(`🧠 **RAG Stats:**\n• Vetores: **${s.totalVectors}**\n• Status: **${s.status}**`);
      }
  
      if (msg.content === '!rag reindex') {
        await msg.reply('🔄 Reindexando todos os canais...');
        for (const channelId of CHANNELS_TO_INDEX) {
          await indexChannelMessages(client, channelId, 100);
          await new Promise(res => setTimeout(res, 1000));
        }
        const s = await getRAGStats();
        await msg.reply(`✅ Reindexação concluída! Total: ${s.totalVectors} vetores`);
      }
  
      if (msg.content.startsWith('!rag add ')) {
        const text = msg.content.replace('!rag add ', '');
        await addDocument(text, { type: 'manual', author: msg.author.username });
        await msg.reply('✅ Documento adicionado à base!');
      }
    });
  
    console.log('[RAG] ✅ Sistema RAG com Pinecone iniciado!');
  }