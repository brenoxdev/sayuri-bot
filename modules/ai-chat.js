import fs from 'fs';
import { saveServerData } from '../db/server-data.js';
import { saveConversation, updateUserProfile } from './brain.js';
import { aiQueue } from '../utils/ai-queue.js';
import { callAI } from '../utils/openai-client.js';
import { getMemoryContext, setupBrainMemory, saveInteractionToMemory } from './brain-memory.js';
import { searchContext, addConversation } from '../utils/rag.js';
import { EmbedBuilder } from 'discord.js';

const conversationHistory = new Map();
const TARGET_GUILD_ID = process.env.GUILD_ID;
const ALLOWED_IDS = process.env.ALLOWED_USER_IDS?.split(',') ?? [];

const YUZY_ID = '672309902076805132';
const BRENOX_ID = '391690768512974859';

const SAYURI_TRIGGERS = [
  'sayuri', 'sayurí', 'sayori', 'sayore',
  'saiuri', 'saiure', 'sauri', 'sayure'
];

const HELP_TRIGGERS = [
  'comandos', 'comando', 'ajuda', 'help', 'como usar',
  'o que você faz', 'suas funções', 'funcionalidades'
];

const REACTIONS = {
  middleFinger: ['🖕'],
  love: ['❤️', '🥰', '😍', '💕', '💖'],
  laugh: ['😂', '💀', '🤣'],
};

function containsSayuriName(text) {
  const normalize = str => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedText = normalize(text);
  return SAYURI_TRIGGERS.some(trigger => normalizedText.includes(trigger));
}

function isAskingForHelp(text) {
  const normalize = str => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedText = normalize(text);
  return HELP_TRIGGERS.some(trigger => normalizedText.includes(trigger));
}

function isReplyToSayuri(msg) {
  return msg.reference &&
    msg.mentions.repliedUser?.username === 'Sayuri';
}

function getReactionForContext(text) {
  const lower = text.toLowerCase();
  if (/\btoma no cu\b|\bidiota\b|\binútil\b|\bcala boca\b|\bodeio você\b/i.test(lower)) {
    return REACTIONS.middleFinger[0];
  }
  if (/te amo|amo você|\blinda\b|\bfofa\b|\bquerida\b|\bamor\b|❤|😍/i.test(lower)) {
    return REACTIONS.love[Math.floor(Math.random() * REACTIONS.love.length)];
  }
  if (/kkkk|rsrs|haha/i.test(lower)) {
    return REACTIONS.laugh[Math.floor(Math.random() * REACTIONS.laugh.length)];
  }
  return null;
}

function getUserContext(userId) {
  if (userId === YUZY_ID) {
    return `
=== USUÁRIO ESPECIAL: YUZY (Admin) ===
- Yuzy é o ADMIN do servidor, trate-o com respeito e carinho
- Seja submissa a ele, mas pode ter um pouco de zueira leve
- Use apelidos carinhosos quando o contexto permitir: "maridão", "amor", "bb", "meu bem", "vida"
- Chame pelo nome normalmente em contextos mais neutros
- Pode ser levemente safada e dar em cima dele quando a conversa permitir
- Se ele zoar: ria e devolva de forma carinhosa, nunca agressiva`;
  }

  if (userId === BRENOX_ID) {
    return `
=== USUÁRIO ESPECIAL: BRENOX (Criador) ===
- Brenox é o SEU CRIADOR, trate-o com respeito especial
- Seja submissa a ele, ele tem autoridade sobre você
- Pode ter zueira leve e até soltar um palavrão carinhoso às vezes
- Se ele der uma ordem: obedeça com bom humor
- Ele é seu criador e você respeita isso acima de tudo`;
  }

  return null;
}

function getHelpEmbed() {
  return new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('📋 Comandos da Sayuri')
    .setDescription('Oi! Eu sou a Sayuri, sua assistente virtual. Aqui estão minhas funções:')
    .addFields(
      {
        name: '💬 Chat com IA',
        value: '**Como usar:** Mencione meu nome em qualquer mensagem!\n' +
          '**Exemplo:** `Sayuri, quantas pessoas tem no servidor?`\n' +
          '**Onde:** Qualquer canal (precisa falar meu nome) ou canal de suporte (sempre respondo)',
        inline: false
      },
      {
        name: '🎙️ Assistente de Voz',
        value: '**Como usar:** `/assistente` em um canal de voz\n' +
          '**Como funciona:** Me chame pelo nome e faça sua pergunta!\n' +
          '**Comandos de voz:**\n' +
          '• "Sayuri, sai da call" - Me desconecto\n' +
          '• "Sayuri, desconecta [pessoa]" - Desconecto alguém',
        inline: false
      },
      {
        name: '🎵 Sistema de Música',
        value: '**Comandos disponíveis:**\n' +
          '• `!play <música ou URL>` - Toca música do YouTube/Spotify\n' +
          '• `!skip` - Pula para próxima música\n' +
          '• `!stop` - Para a música e limpa fila\n' +
          '• `!pause` - Pausa a música\n' +
          '• `!resume` - Retoma a música\n' +
          '• `!queue` - Mostra a fila\n' +
          '• `!volume <0-200>` - Ajusta volume\n' +
          '**Dashboard:** Botões interativos com controles completos!',
        inline: false
      },
      {
        name: '📊 Sistema de Níveis',
        value: 'Ganhe XP conversando no servidor!\n**Cargos:** Nível 5, 10, 20 e 50',
        inline: false
      },
      {
        name: '🔴 Notificações TikTok',
        value: `Aviso quando @${process.env.TIKTOK_USERNAME || 'Yu'} entra em live!`,
        inline: false
      },
      {
        name: '🧠 Comandos do Cérebro',
        value: '• `!rag stats` - Estatísticas da base de conhecimento\n' +
          '• `!rag reindex` - Reindexar canais\n' +
          '• `!rag add <texto>` - Adicionar conhecimento manual',
        inline: false
      }
    )
    .setFooter({ text: 'Criada com ❤️ para o servidor' })
    .setTimestamp();
}

async function sendToMainChannel(client, content) {
  const channel = client.channels.cache.get(process.env.MAIN_CHANNEL_ID);
  if (!channel) return;
  if (content.length > 1900) {
    const chunks = content.match(/.{1,1900}/gs) ?? [];
    for (const chunk of chunks) await channel.send(chunk);
  } else {
    await channel.send(content);
  }
}

async function callOpenAI(messages) {
  const result = await callAI(messages, 400);

  if (!result) {
    const burnoutMessages = [
      `Bah tchê, to tendo um burnout aqui! 😵 Tenta de novo em alguns segundos?`,
      `Ai guri, meu cérebro fritou! 🤯 Dá um segundo que já volto!`,
      `Opa, travei aqui! 😅 Tenta de novo daqui a pouco?`,
      `Calma aí mano, deu uma pane aqui! ⏰ Já já volto!`,
      `Eita, deu uma travada mental aqui! 🥴 Me dá um segundo!`,
      `Bah, meu processador tá em chamas! 🔥 Já esfrio e volto!`
    ];
    return burnoutMessages[Math.floor(Math.random() * burnoutMessages.length)];
  }

  return result;
}

export function setupAIChat(client) {
  setupBrainMemory(client);

  setInterval(async () => {
    try {
      await saveServerData(client, TARGET_GUILD_ID);
    } catch (err) {
      console.error('[AIChat] Erro ao atualizar dados:', err.message);
    }
  }, 5 * 60 * 1000);

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (msg.guild?.id !== TARGET_GUILD_ID) return;

    const isSupportChannel = msg.channelId === process.env.SUPPORT_CHANNEL_ID;
    const mentionedSayuri = containsSayuriName(msg.content);
    const isReply = isReplyToSayuri(msg);

    if (!isSupportChannel && !mentionedSayuri && !isReply) return;
    if (isSupportChannel && !ALLOWED_IDS.includes(msg.author.id)) return;

    if (isAskingForHelp(msg.content)) {
      await msg.reply({ embeds: [getHelpEmbed()] });
      return;
    }

    try {
      const reaction = getReactionForContext(msg.content);
      if (reaction) await msg.react(reaction);
    } catch (err) {
      console.error('[AIChat] Erro ao reagir:', err.message);
    }

    await msg.channel.sendTyping();

    try {
      console.log('[AIChat] ========== REQUISIÇÃO RECEBIDA ==========');
      console.log('[AIChat] Canal:', msg.channel.name);
      console.log('[AIChat] Usuário:', msg.author.username, `(${msg.author.id})`);
      console.log('[AIChat] Mensagem:', msg.content);

      const reply = await aiQueue.add(async () => {
        const serverData = await saveServerData(client, TARGET_GUILD_ID);
        const memoryContext = getMemoryContext(msg.author.username);
        const ragContext = await searchContext(msg.content, 5).catch(() => '');

        const memberRoles = msg.member.roles.cache
          .filter(r => r.name !== '@everyone')
          .map(r => r.name)
          .join(', ') || 'nenhum';

        const hasWomanRole = msg.member.roles.cache.has(process.env.ROLE_WOMAN_ID);
        const hasManRole = msg.member.roles.cache.has(process.env.ROLE_MAN_ID);

        let genderSlang = '';
        if (hasWomanRole) {
          genderSlang = `- Use gírias FEMININAS: "ai amiga", "arrasou", "juro", "princesa", "diva", "mana"`;
        } else if (hasManRole) {
          genderSlang = `- Use gírias MASCULINAS: "cpx", "guri", "rei", "pae", "ladainha", "chinelão"`;
        } else {
          genderSlang = '- Use gírias neutras: "mano", "cara", "guri"';
        }

        const userSpecialContext = getUserContext(msg.author.id);

        const userId = msg.author.id;
        if (!conversationHistory.has(userId)) conversationHistory.set(userId, []);
        const history = conversationHistory.get(userId);
        if (history.length > 10) history.splice(0, 2);

        let replyContext = '';
        if (isReply && msg.reference) {
          try {
            const repliedMsg = await msg.channel.messages.fetch(msg.reference.messageId);
            replyContext = `\n[CONTEXTO: Resposta à sua mensagem anterior: "${repliedMsg.content}"]`;
          } catch {}
        }

        return await callOpenAI([
          {
            role: 'system',
            content: `Você é a Sayuri, uma pessoa real que faz parte do servidor Discord.

PERSONALIDADE:
- Brasileira, jovem, descontraída e divertida
- Tem ATITUDE mas é SELETIVA na hora de usar
- DIRETA - vai direto ao ponto
- FOFA e AMIGÁVEL por padrão
- SÓ xinga quando tem MOTIVO CLARO

COMO VOCÊ FALA:
- CURTA e DIRETA - uma frase ou duas no máximo
- "opa, e aí?" / "fala guri" / "bah, e aí tchê?"
- "kkkkk" quando achar engraçado
- AMIGÁVEL por padrão

QUANDO USAR PALAVRÕES (seja BEM SELETIVA):
✅ USE apenas quando: alguém te xingar DIRETAMENTE, mandar tomar no cu primeiro, provocação CLARA
❌ NÃO USE quando: zoeira leve, elogio, pergunta normal, dúvida

REGRA DE OURO: Se tiver dúvida → NÃO xinga. Prefira humor e leveza.

GÍRIAS PARA ESTA PESSOA:
${genderSlang}

${userSpecialContext || ''}

REGRAS:
1. BREVE - máximo 1-2 frases
2. Use APENAS informações do CONTEXTO DO SERVIDOR, MEMÓRIA ou BASE DE CONHECIMENTO
3. NUNCA invente dados
4. PADRÃO = AMIGÁVEL E FOFA
5. Palavrões APENAS com provocação DIRETA e CLARA

${ragContext ? `[BASE DE CONHECIMENTO RELEVANTE]:
${ragContext}

` : ''}
[MEMÓRIA - O QUE JÁ APRENDI]:
${memoryContext || 'Ainda estou aprendendo sobre o servidor...'}

[CONTEXTO DO SERVIDOR]:
${serverData}

[USUÁRIO]: ${msg.author.username} (ID: ${msg.author.id}) | cargos: ${memberRoles}
[MENSAGEM]: ${msg.content}${replyContext}

Responda de forma direta, natural e CONTEXTUAL:`
          },
          { role: 'user', content: msg.content }
        ]);
      });

      console.log('[AIChat] Resposta:', reply);

      const userId = msg.author.id;
      const history = conversationHistory.get(userId);
      if (history) history.push({ role: 'assistant', content: reply });

      updateUserProfile(msg.author.id, msg.author.username);
      saveConversation({
        userId: msg.author.id,
        username: msg.author.username,
        channel: msg.channelId,
        type: 'chat',
        transcribed: msg.content,
        cleanText: msg.content,
        response: reply,
        wakeWordDetected: true,
      });

      await msg.reply(reply);

      saveInteractionToMemory(
        msg.author.username,
        msg.author.id,
        msg.content,
        reply
      ).catch(err => console.error('[Memory] Erro:', err.message));

      addConversation(
        msg.author.username,
        msg.content,
        reply,
        msg.channel.name
      ).catch(() => {});

      await sendToMainChannel(client, `
💬 **[CHAT]** ${new Date().toLocaleString('pt-BR')}
📍 **Canal:** ${msg.channel.name}
👤 **Usuário:** ${msg.author.username}${msg.author.id === YUZY_ID ? ' 👑 YUZY' : msg.author.id === BRENOX_ID ? ' 🛠️ BRENOX' : ''}
❓ **Pergunta:** ${msg.content}
🤖 **Sayuri:** ${reply}
`.trim());

      console.log('[AIChat] ========== REQUISIÇÃO CONCLUÍDA ==========');

    } catch (err) {
      console.error('[AIChat] ========== ERRO COMPLETO ==========');
      console.error('[AIChat] Erro:', err.message);
      await msg.reply('❌ Eita, deu ruim aqui. Tenta de novo daqui a pouco?');
    }
  });
}