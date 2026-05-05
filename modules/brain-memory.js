import { loadMemory, saveMemory } from '../utils/memory.js';
import { callAI } from '../utils/openai-client.js';
import fs from 'fs';

const CHANNELS_TO_READ = [
  '1497456609947811932', // MAIN
  '1497456270377226360', // SUPPORT
  '1429652453078597733', // CHAT
  '1497455959251877938', // BRAIN
].filter(Boolean);

const LEARN_INTERVAL = 15 * 60 * 1000;
const MAX_MESSAGES = 50;

// ==================== MEMÓRIA EM TEMPO REAL ====================

export async function saveInteractionToMemory(username, userId, message, response) {
  try {
    const memory = loadMemory();

    if (!memory.patterns.members[username]) {
      memory.patterns.members[username] = {
        personality: '',
        interests: [],
        relationship: '',
        facts: [],
        recentMessages: []
      };
    }

    const member = memory.patterns.members[username];

    if (!member.recentMessages) member.recentMessages = [];
    member.recentMessages.push({
      msg: message.slice(0, 200),
      res: response.slice(0, 200),
      time: new Date().toISOString()
    });

    if (member.recentMessages.length > 10) {
      member.recentMessages = member.recentMessages.slice(-10);
    }

    const analysis = await analyzeInteraction(username, message, response, member);

    if (analysis) {
      if (analysis.personality) member.personality = analysis.personality;
      if (analysis.newInterests?.length) {
        member.interests = [...new Set([...(member.interests || []), ...analysis.newInterests])].slice(-10);
      }
      if (analysis.newFacts?.length) {
        member.facts = [...new Set([...(member.facts || []), ...analysis.newFacts])].slice(-15);
      }
      if (analysis.relationship) member.relationship = analysis.relationship;

      if (analysis.serverFacts?.length) {
        memory.patterns.serverContext = [
          ...new Set([...(memory.patterns.serverContext || []), ...analysis.serverFacts])
        ].slice(-30);
      }
    }

    memory.lastUpdated = new Date().toISOString();
    saveMemory(memory);

    console.log(`[BrainMemory] 💾 Interação de ${username} salva na memória`);

  } catch (err) {
    console.error('[BrainMemory] Erro ao salvar interação:', err.message);
  }
}

async function analyzeInteraction(username, message, response, existingMember) {
  try {
    const existingInfo = `
Personalidade atual: ${existingMember.personality || 'desconhecida'}
Interesses conhecidos: ${(existingMember.interests || []).join(', ') || 'nenhum'}
Fatos conhecidos: ${(existingMember.facts || []).join(', ') || 'nenhum'}
Relacionamento: ${existingMember.relationship || 'desconhecido'}
    `.trim();

    const result = await callAI([
      {
        role: 'system',
        content: `Você analisa interações de Discord e extrai informações sobre o usuário.
Responda APENAS em JSON válido sem texto adicional:
{
  "personality": "descrição curta da personalidade (ou null se não mudou)",
  "newInterests": ["interesse novo detectado"],
  "newFacts": ["fato novo e relevante sobre o usuário"],
  "relationship": "como ele interage com a Sayuri (ou null se não mudou)",
  "serverFacts": ["fato novo sobre o servidor se mencionado"]
}

Regras:
- Só adicione fatos RELEVANTES e CONCRETOS
- Não repita informações que já existem
- newInterests e newFacts podem ser arrays vazios []
- personality e relationship só mude se houver algo novo claro`
      },
      {
        role: 'user',
        content: `Usuário: ${username}
Informações existentes:
${existingInfo}

Nova interação:
[${username}]: ${message}
[Sayuri]: ${response}

O que aprender com isso?`
      }
    ], 300);

    if (!result) return null;

    const clean = result.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.error('[BrainMemory] Erro ao analisar interação:', err.message);
    return null;
  }
}

// ==================== LEITURA DE CANAIS ====================

async function fetchChannelMessages(client, channelId, afterMessageId = null) {
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return [];

    const options = { limit: MAX_MESSAGES };
    if (afterMessageId) options.after = afterMessageId;

    const messages = await channel.messages.fetch(options);

    return Array.from(messages.values())
      .reverse()
      .map(msg => ({
        id: msg.id,
        author: msg.author.username,
        isSayuri: msg.author.bot && msg.author.username === 'Sayuri',
        content: msg.content?.slice(0, 300),
        timestamp: msg.createdAt
      }))
      .filter(msg => msg.content && msg.content.length > 2);

  } catch (err) {
    console.error(`[BrainMemory] Erro canal ${channelId}:`, err.message);
    return [];
  }
}

async function analyzeWithGroq(messagesText) {
  try {
    const result = await callAI([
      {
        role: 'system',
        content: `Você analisa conversas de um servidor Discord brasileiro.
Responda APENAS em JSON válido sem texto adicional:
{
  "members": {
    "username": {
      "personality": "descrição curta",
      "interests": ["interesse"],
      "relationship": "como interage com Sayuri",
      "facts": ["fato relevante"]
    }
  },
  "topics": {"topico": "contexto"},
  "serverFacts": ["fato sobre o servidor"],
  "insightsForSayuri": ["como melhorar respostas"]
}`
      },
      {
        role: 'user',
        content: `Analise estas conversas:\n\n${messagesText}`
      }
    ], 800);

    if (!result) return null;

    const clean = result.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.error('[BrainMemory] Erro ao analisar:', err.message);
    return null;
  }
}

function mergeMemory(memory, analysis) {
  if (!analysis) return;

  if (analysis.members) {
    for (const [name, data] of Object.entries(analysis.members)) {
      if (!memory.patterns.members[name]) {
        memory.patterns.members[name] = data;
      } else {
        const existing = memory.patterns.members[name];
        if (data.personality) existing.personality = data.personality;
        existing.interests = [...new Set([...(existing.interests || []), ...(data.interests || [])])].slice(-10);
        existing.facts = [...new Set([...(existing.facts || []), ...(data.facts || [])])].slice(-15);
        if (data.relationship) existing.relationship = data.relationship;
      }
    }
  }

  if (analysis.topics) {
    for (const [topic, context] of Object.entries(analysis.topics)) {
      memory.patterns.topics[topic] = context;
    }
  }

  if (analysis.serverFacts?.length) {
    memory.patterns.serverContext = [
      ...new Set([...(memory.patterns.serverContext || []), ...analysis.serverFacts])
    ].slice(-30);
  }

  if (analysis.insightsForSayuri?.length) {
    memory.patterns.goodResponses = [
      ...new Set([...(memory.patterns.goodResponses || []), ...analysis.insightsForSayuri])
    ].slice(-20);
  }
}

export async function learnFromHistory(client) {
  console.log('[BrainMemory] Iniciando aprendizado dos canais...');

  const memory = loadMemory();
  let totalMessages = 0;
  let allMessagesText = '';

  for (const channelId of CHANNELS_TO_READ) {
    const lastId = memory.channelLastIds?.[channelId] || null;
    const messages = await fetchChannelMessages(client, channelId, lastId);

    if (messages.length === 0) continue;

    totalMessages += messages.length;

    const channelText = messages
      .map(msg => `[${msg.author}${msg.isSayuri ? ' (Sayuri)' : ''}]: ${msg.content}`)
      .join('\n');

    allMessagesText += `\n--- Canal ${channelId} ---\n${channelText}\n`;

    if (!memory.channelLastIds) memory.channelLastIds = {};
    memory.channelLastIds[channelId] = messages[messages.length - 1].id;
  }

  if (totalMessages === 0) {
    console.log('[BrainMemory] Nenhuma mensagem nova');
    return;
  }

  console.log(`[BrainMemory] Analisando ${totalMessages} mensagens...`);

  const analysis = await analyzeWithGroq(allMessagesText.slice(0, 8000));
  mergeMemory(memory, analysis);

  memory.lastUpdated = new Date().toISOString();
  saveMemory(memory);

  console.log(`[BrainMemory] ✅ Membros: ${Object.keys(memory.patterns.members).length} | Tópicos: ${Object.keys(memory.patterns.topics).length}`);
}

// ==================== CONTEXTO PARA O PROMPT ====================

export function getMemoryContext(username = null) {
  const memory = loadMemory();
  if (!memory.lastUpdated) return '';

  const parts = [];

  if (username && memory.patterns.members[username]) {
    const member = memory.patterns.members[username];
    parts.push(`=== O QUE SEI SOBRE ${username.toUpperCase()} ===`);
    if (member.personality) parts.push(`• Personalidade: ${member.personality}`);
    if (member.relationship) parts.push(`• Relacionamento: ${member.relationship}`);
    if (member.interests?.length) parts.push(`• Interesses: ${member.interests.join(', ')}`);
    if (member.facts?.length) parts.push(`• Fatos: ${member.facts.join(', ')}`);

    if (member.recentMessages?.length) {
      parts.push(`• Últimas interações:`);
      member.recentMessages.slice(-3).forEach(m => {
        parts.push(`  [ele]: ${m.msg}`);
        parts.push(`  [eu]: ${m.res}`);
      });
    }
    parts.push('');
  }

  const otherMembers = Object.entries(memory.patterns.members)
    .filter(([name]) => name !== username);

  if (otherMembers.length > 0) {
    parts.push('=== OUTROS MEMBROS ===');
    for (const [name, data] of otherMembers) {
      parts.push(`• ${name}: ${data.personality || ''} | ${data.relationship || ''} | Fatos: ${(data.facts || []).slice(-2).join(', ')}`);
    }
  }

  if (memory.patterns.serverContext?.length > 0) {
    parts.push('\n=== CONTEXTO DO SERVIDOR ===');
    memory.patterns.serverContext.slice(-8).forEach(fact => parts.push(`• ${fact}`));
  }

  if (memory.patterns.goodResponses?.length > 0) {
    parts.push('\n=== COMO MELHORAR RESPOSTAS ===');
    memory.patterns.goodResponses.slice(-5).forEach(tip => parts.push(`• ${tip}`));
  }

  return parts.join('\n');
}

// ==================== SETUP ====================

export function setupBrainMemory(client) {
  setTimeout(() => learnFromHistory(client), 30 * 1000);
  setInterval(() => learnFromHistory(client), LEARN_INTERVAL);
  console.log(`[BrainMemory] ✅ Sistema iniciado! Lendo ${CHANNELS_TO_READ.length} canais a cada ${LEARN_INTERVAL / 60000} minutos + aprendizado em tempo real`);
}