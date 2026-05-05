// modules/brain.js
import {
    saveConversation,
    learnWakeWord,
    getLearnedWakeWords,
    getUserProfile,
    getUserConversations,
    getRecentConversations,
    addUserNote,
    getFailedWakeWords,
    updateUserProfile,
  } from '../db/memory.js';
  
  const BRAIN_CHANNEL_ID = process.env.BRAIN_CHANNEL_ID;
  
  export function setupBrain(client) {
    // Relatório automático a cada hora
    setInterval(() => sendBrainReport(client), 60 * 60 * 1000);
  
    // Comandos no canal cérebro
    client.on('messageCreate', async (msg) => {
      if (msg.author.bot) return;
      if (msg.channelId !== BRAIN_CHANNEL_ID) return;
  
      const [cmd, ...args] = msg.content.trim().split(/\s+/);
  
      switch (cmd.toLowerCase()) {
        // !cerebro status — visão geral
        case '!cerebro': {
          const conversations = getRecentConversations(100);
          const wakeWords = getLearnedWakeWords();
          const failed = getFailedWakeWords(10);
  
          const voiceCount = conversations.filter(c => c.type === 'voice').length;
          const chatCount = conversations.filter(c => c.type === 'chat').length;
          const wakeDetected = conversations.filter(c => c.wake_word_detected).length;
  
          await msg.reply(`
  🧠 **Status do Cérebro da Sayuri**
  
  📊 **Conversas recentes (últimas 100):**
  - Voz: ${voiceCount}
  - Chat: ${chatCount}
  - Wake word detectada: ${wakeDetected}
  - Wake word falhou: ${conversations.length - wakeDetected}
  
  🔤 **Wake words aprendidas (${wakeWords.length}):**
  ${wakeWords.slice(0, 10).map(w => `- \`${w.word}\` — ${w.hits}x detectada`).join('\n')}
  
  ❌ **Frases que falharam a wake word (top 10):**
  ${failed.map(f => `- "${f.transcribed}" — ${f.count}x`).join('\n') || 'Nenhuma ainda'}
          `.trim());
          break;
        }
  
        // !usuario @mention — perfil do usuário
        case '!usuario': {
          const target = msg.mentions.users.first();
          if (!target) return msg.reply('Use: `!usuario @usuário`');
  
          const profile = getUserProfile(target.id);
          if (!profile) return msg.reply('Usuário não encontrado na memória.');
  
          const convs = getUserConversations(target.id, 5);
          const lastConvs = convs.map(c =>
            `- [${c.type}] "${c.transcribed || c.clean_text}" → "${c.response?.slice(0, 50)}..."`
          ).join('\n');
  
          await msg.reply(`
  👤 **Perfil: ${profile.username}**
  - ID: ${profile.user_id}
  - Primeira vez: ${profile.first_seen}
  - Última vez: ${profile.last_seen}
  - Total de interações: ${profile.total_interactions}
  - Notas: ${profile.notes || 'Nenhuma'}
  
  💬 **Últimas conversas:**
  ${lastConvs || 'Nenhuma ainda'}
          `.trim());
          break;
        }
  
        // !nota @mention texto — adiciona nota a um usuário
        case '!nota': {
          const target = msg.mentions.users.first();
          if (!target) return msg.reply('Use: `!nota @usuário texto da nota`');
          const note = args.slice(1).join(' ');
          if (!note) return msg.reply('Digite o texto da nota.');
          addUserNote(target.id, note);
          await msg.reply(`✅ Nota adicionada para **${target.username}**: "${note}"`);
          break;
        }
  
        // !conversas — últimas conversas
        case '!conversas': {
          const limit = parseInt(args[0]) || 10;
          const convs = getRecentConversations(limit);
          if (!convs.length) return msg.reply('Nenhuma conversa registrada ainda.');
  
          const list = convs.map(c =>
            `**${c.username}** [${c.type}] — "${c.transcribed || c.clean_text}"\n→ "${c.response?.slice(0, 80)}"`
          ).join('\n\n');
  
          if (list.length > 1900) {
            const chunks = list.match(/.{1,1900}/gs) ?? [];
            for (const chunk of chunks) await msg.channel.send(chunk);
          } else {
            await msg.reply(list);
          }
          break;
        }
  
        // !aprender palavra — adiciona uma wake word manualmente
        case '!aprender': {
          const word = args.join(' ').toLowerCase().trim();
          if (!word) return msg.reply('Use: `!aprender palavra`');
          learnWakeWord(word);
          await msg.reply(`✅ Wake word \`${word}\` adicionada à memória!`);
          break;
        }
  
        // !ajuda — lista os comandos
        case '!ajuda': {
          await msg.reply(`
  🧠 **Comandos do Cérebro da Sayuri:**
  - \`!cerebro\` — visão geral do status
  - \`!conversas [n]\` — últimas N conversas (padrão: 10)
  - \`!usuario @mention\` — perfil e histórico do usuário
  - \`!nota @mention texto\` — adiciona nota a um usuário
  - \`!aprender palavra\` — adiciona wake word manualmente
          `.trim());
          break;
        }
      }
    });
  }
  
  // Envia relatório automático no canal cérebro
  async function sendBrainReport(client) {
    const channel = client.channels.cache.get(BRAIN_CHANNEL_ID);
    if (!channel) return;
  
    const conversations = getRecentConversations(50);
    const failed = getFailedWakeWords(5);
    const wakeWords = getLearnedWakeWords();
  
    await channel.send(`
  🕐 **Relatório automático — ${new Date().toLocaleString('pt-BR')}**
  
  📊 Conversas na última hora: ${conversations.length}
  🔤 Wake words na memória: ${wakeWords.length}
  ❌ Frases que mais falham:
  ${failed.map(f => `- "${f.transcribed}" (${f.count}x)`).join('\n') || 'Nenhuma'}
    `.trim());
  }
  
  // Exporta funções para usar nos outros módulos
  export { saveConversation, learnWakeWord, updateUserProfile };