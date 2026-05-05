// db/memory.js
import Database from 'better-sqlite3';

const db = new Database('./db/sayuri-memory.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    username TEXT,
    channel TEXT,
    type TEXT,
    transcribed TEXT,
    clean_text TEXT,
    response TEXT,
    wake_word_detected INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wake_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE,
    hits INTEGER DEFAULT 1,
    learned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME,
    total_interactions INTEGER DEFAULT 0,
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS server_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Salva uma conversa
export function saveConversation(data) {
  db.prepare(`
    INSERT INTO conversations 
    (user_id, username, channel, type, transcribed, clean_text, response, wake_word_detected)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.userId,
    data.username,
    data.channel,
    data.type, // 'voice' ou 'chat'
    data.transcribed ?? '',
    data.cleanText ?? '',
    data.response ?? '',
    data.wakeWordDetected ? 1 : 0
  );
}

// Aprende uma nova wake word
export function learnWakeWord(word) {
  const normalized = word.toLowerCase().trim();
  try {
    db.prepare(`
      INSERT INTO wake_words (word) VALUES (?)
      ON CONFLICT(word) DO UPDATE SET hits = hits + 1
    `).run(normalized);
  } catch {}
}

// Busca as wake words aprendidas
export function getLearnedWakeWords() {
  return db.prepare('SELECT * FROM wake_words ORDER BY hits DESC').all();
}

// Atualiza perfil do usuário
export function updateUserProfile(userId, username) {
  db.prepare(`
    INSERT INTO user_profiles (user_id, username, last_seen, total_interactions)
    VALUES (?, ?, CURRENT_TIMESTAMP, 1)
    ON CONFLICT(user_id) DO UPDATE SET
      username = ?,
      last_seen = CURRENT_TIMESTAMP,
      total_interactions = total_interactions + 1
  `).run(userId, username, username);
}

// Busca perfil de um usuário
export function getUserProfile(userId) {
  return db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
}

// Busca todas as conversas de um usuário
export function getUserConversations(userId, limit = 20) {
  return db.prepare(`
    SELECT * FROM conversations 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `).all(userId, limit);
}

// Busca conversas recentes
export function getRecentConversations(limit = 50) {
  return db.prepare(`
    SELECT * FROM conversations 
    ORDER BY timestamp DESC 
    LIMIT ?
  `).all(limit);
}

// Adiciona nota a um usuário
export function addUserNote(userId, note) {
  db.prepare(`
    UPDATE user_profiles SET notes = notes || '\n' || ? WHERE user_id = ?
  `).run(`[${new Date().toLocaleString('pt-BR')}] ${note}`, userId);
}

// Salva snapshot do servidor
export function saveServerSnapshot(data) {
  db.prepare('INSERT INTO server_snapshots (data) VALUES (?)').run(data);
}

// Busca todas as wake words que falharam para aprender
export function getFailedWakeWords(limit = 50) {
  return db.prepare(`
    SELECT transcribed, COUNT(*) as count 
    FROM conversations 
    WHERE wake_word_detected = 0 AND transcribed != ''
    GROUP BY transcribed 
    ORDER BY count DESC
    LIMIT ?
  `).all(limit);
}

export default db;