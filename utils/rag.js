import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';

let index = null;

// ==================== INICIALIZAÇÃO ====================
export async function initRAG() {
  try {
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    index = pc.index(process.env.PINECONE_INDEX, process.env.PINECONE_HOST);

    const stats = await index.describeIndexStats();
    console.log(`[RAG] ✅ Pinecone conectado! Vetores: ${stats.totalRecordCount}`);

  } catch (err) {
    console.error('[RAG] Erro ao conectar Pinecone:', err.message);
  }
}

// ==================== CHUNK TEXT ====================
function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks.filter(c => c.trim().length > 20);
}

// ==================== ADICIONAR DOCUMENTO ====================
export async function addDocument(content, metadata = {}) {
  if (!index) return false;

  try {
    const chunks = chunkText(content, 500, 50);
    const records = [];

    for (let i = 0; i < chunks.length; i++) {
      const id = `${metadata.type || 'doc'}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
      
      records.push({
        id,
        text: chunks[i], // Pinecone gera embedding automaticamente
        type: metadata.type || 'doc',
        author: metadata.author || '',
        channel: metadata.channel || '',
        timestamp: metadata.timestamp || new Date().toISOString(),
        chunkIndex: String(i)
      });
    }

    if (records.length === 0) return false;

    // Upsert em batches de 10
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10);
      await index.upsertRecords(batch);
    }

    console.log(`[RAG] ✅ ${records.length} chunks adicionados (tipo: ${metadata.type})`);
    return true;

  } catch (err) {
    console.error('[RAG] Erro ao adicionar documento:', err.message);
    return false;
  }
}

// ==================== BUSCAR CONTEXTO ====================
export async function searchContext(query, topK = 5) {
  if (!index) return '';

  try {
    const results = await index.searchRecords({
      query: {
        inputs: { text: query }, // Pinecone gera embedding automaticamente
        topK
      },
      fields: ['text', 'type', 'author', 'channel', 'timestamp']
    });

    const hits = results.result?.hits ?? [];
    if (hits.length === 0) return '';

    // Filtra por relevância (score > 0.5)
    const relevant = hits.filter(h => h._score > 0.5);
    if (relevant.length === 0) return '';

    const context = relevant.map(h => {
      const type = h.fields?.type || 'doc';
      const author = h.fields?.author ? ` (${h.fields.author})` : '';
      const text = h.fields?.text || '';
      return `[${type}${author}]: ${text}`;
    }).join('\n\n');

    console.log(`[RAG] 🔍 ${relevant.length} chunks relevantes para: "${query.slice(0, 50)}"`);
    return context;

  } catch (err) {
    console.error('[RAG] Erro na busca:', err.message);
    return '';
  }
}

// ==================== ADICIONAR CONVERSA ====================
export async function addConversation(username, message, response, channelName) {
  if (!index) return;

  const content = `Conversa em #${channelName}
${username}: ${message}
Sayuri: ${response}`;

  await addDocument(content, {
    type: 'conversa',
    author: username,
    channel: channelName,
    timestamp: new Date().toISOString()
  });
}

// ==================== ADICIONAR REGRAS ====================
export async function addRules(rules) {
  await addDocument(rules, {
    type: 'regras',
    importance: 'high'
  });
  console.log('[RAG] ✅ Regras adicionadas!');
}

// ==================== ADICIONAR FAQ ====================
export async function addFAQ(question, answer) {
  const content = `Pergunta: ${question}\nResposta: ${answer}`;
  await addDocument(content, {
    type: 'faq',
    question: question.slice(0, 100)
  });
}

// ==================== INDEXAR CANAL DO DISCORD ====================
export async function indexChannelMessages(client, channelId, limit = 100) {
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit });
    const msgArray = Array.from(messages.values()).reverse();

    console.log(`[RAG] Indexando ${msgArray.length} mensagens do #${channel.name}...`);

    // Agrupa em blocos de 10 mensagens
    for (let i = 0; i < msgArray.length; i += 10) {
      const chunk = msgArray.slice(i, i + 10);
      const content = chunk
        .filter(m => m.content?.length > 5 && !m.author.bot)
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

      if (!content.trim()) continue;

      await addDocument(content, {
        type: 'historico',
        channel: channel.name,
        channelId,
        timestamp: chunk[0]?.createdAt?.toISOString()
      });

      await new Promise(res => setTimeout(res, 300));
    }

    console.log(`[RAG] ✅ #${channel.name} indexado!`);
  } catch (err) {
    console.error('[RAG] Erro ao indexar canal:', err.message);
  }
}

// ==================== ESTATÍSTICAS ====================
export async function getRAGStats() {
  if (!index) return { totalVectors: 0, status: 'offline' };
  try {
    const stats = await index.describeIndexStats();
    return {
      totalVectors: stats.totalRecordCount,
      status: 'online'
    };
  } catch {
    return { totalVectors: 0, status: 'offline' };
  }
}