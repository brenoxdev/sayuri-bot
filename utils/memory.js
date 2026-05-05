import fs from 'fs';
import path from 'path';

const MEMORY_FILE = 'db/sayuri-memory.json';

// Estrutura da memória
function getDefaultMemory() {
  return {
    lastUpdated: null,
    lastMessageId: null, // Para não reler mensagens já processadas
    patterns: {
      // Aprendizados sobre membros
      members: {},
      // Tópicos frequentes
      topics: {},
      // Respostas que funcionaram bem
      goodResponses: [],
      // Contextos do servidor
      serverContext: []
    }
  };
}

export function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Memory] Erro ao carregar memória:', err.message);
  }
  return getDefaultMemory();
}

export function saveMemory(memory) {
  try {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (err) {
    console.error('[Memory] Erro ao salvar memória:', err.message);
  }
}