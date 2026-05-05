import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  EndBehaviorType,
} from '@discordjs/voice';
import prism from 'prism-media';
import gtts from 'gtts';
import fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { saveServerData } from '../db/server-data.js';
import { saveConversation, learnWakeWord, updateUserProfile } from './brain.js';

EventEmitter.defaultMaxListeners = 20;

const pipelineAsync = promisify(pipeline);
const WHISPER_BIN = `${process.env.HOME}/whisper.cpp/build/bin/whisper-cli`;
const WHISPER_MODEL = `${process.env.HOME}/whisper.cpp/models/ggml-base.bin`;
const TARGET_GUILD_ID = process.env.GUILD_ID;
const ALLOWED_IDS = process.env.ALLOWED_USER_IDS?.split(',') ?? [];

const IGNORE_PHRASES = [
  '[música de fundo]', '[musica de fundo]', '(música de fundo)',
  '[music]', '[silence]', '[silêncio]', '[ruído]', '[ruido]',
  '[música]', '(música)', '[musica]', '(musica)',
  'music', '♪', '[ música ]',
];

const WAKE_WORDS = [
  'sayuri', 'sayurí',
  'sayori', 'sayore',
  'saiuri', 'saiure', 'saíure', 'saíuri',
  'saiur', 'sayur', 'saur',
  'sayure', 'saure', 'saiur e',
  'say uri', 'say ure', 'say ori',
  'saori', 'saury', 'sayuris',
  'sa yuri', 'sa iuri', 'sa uri',
  'seuri', 'seyuri', 'seyure',
  'chauri', 'xauri', 'shauri',
  'zauri', 'zauris',
];

const DISCONNECT_COMMANDS = [
  'desconectar', 'desconecta', 'sair', 'sai', 'tchau', 'bye',
  'adeus', 'até mais', 'ate mais', 'pode sair', 'encerrar',
  'encerra', 'fechar', 'fecha', 'desliga', 'desligar',
  'vai embora', 'saída', 'saida', 'leave', 'disconnect',
];

const KICK_VOICE_COMMANDS = [
  'desconectar', 'desconecta', 'kick', 'expulsar', 'expulsa',
  'remove', 'remover', 'tira', 'tirar', 'bota pra fora',
  'bota para fora', 'joga fora', 'manda embora', 'retira',
];

function containsWakeWord(text) {
  const normalize = str => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedText = normalize(text);
  return WAKE_WORDS.map(normalize).some(w => normalizedText.includes(w));
}

function containsDisconnectCommand(text) {
  const normalize = str => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedText = normalize(text);
  return DISCONNECT_COMMANDS.map(normalize).some(c => normalizedText.includes(c));
}

function containsKickVoiceCommand(text) {
  const normalize = str => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedText = normalize(text);
  return KICK_VOICE_COMMANDS.map(normalize).some(c => normalizedText.includes(c));
}

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

async function findMemberByName(guild, text) {
  await guild.members.fetch();
  const members = guild.members.cache.filter(m => !m.user.bot);
  const normalizedText = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  console.log('[Sayuri] Buscando membro em:', normalizedText);
  console.log('[Sayuri] Membros disponíveis:', members.map(m => m.user.username).join(', '));

  return members.find(m => {
    const name = m.user.username.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const displayName = m.displayName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    console.log(`[Sayuri] Comparando com "${name}" / "${displayName}"`);
    return normalizedText.includes(name) || normalizedText.includes(displayName);
  });
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

export function setupVoiceAI(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'assistente') return;

    if (!ALLOWED_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Você não tem permissão para usar a Sayuri.',
        ephemeral: true
      });
    }

    const voice = interaction.member?.voice.channel;
    if (!voice) {
      return interaction.reply({ content: '❌ Entre em um canal de voz primeiro!', ephemeral: true });
    }

    await interaction.reply('🎙️ Assistente **Sayuri** ativada! Me chame pelo nome para falar comigo.');

    await sendToMainChannel(client, `
🎙️ **[VOZ ATIVADA]** ${new Date().toLocaleString('pt-BR')}
👤 **Usuário:** ${interaction.user.username}
🔊 **Canal:** ${voice.name}
`.trim());

    const player = createAudioPlayer();
    player.on('error', err => console.error('[Player]', err.message));

    const connection = joinVoiceChannel({
      channelId: voice.id,
      guildId: voice.guild.id,
      adapterCreator: voice.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
      console.log('[Sayuri] Conectada ao canal de voz.');
    } catch {
      return interaction.followUp('❌ Não consegui entrar no canal de voz.');
    }

    connection.subscribe(player);

    const receiver = connection.receiver;
    const processingUsers = new Set();
    const lastSpoke = new Map();

    let activeMode = false;
    let activeModeTimer = null;

    function activateSayuri(durationMs = 15000) {
      activeMode = true;
      console.log(`[Sayuri] Modo ativo por ${durationMs / 1000}s.`);
      clearTimeout(activeModeTimer);
      activeModeTimer = setTimeout(() => {
        activeMode = false;
        console.log('[Sayuri] Modo inativo — aguardando ser chamada.');
      }, durationMs);
    }

    async function disconnectSayuri(member) {
      const greeting = getGreetingByTime();
      const membersInChannel = voice.members
        .filter(m => !m.user.bot)
        .map(m => m.user.username);

      let farewell = '';
      if (membersInChannel.length === 1) {
        farewell = `${greeting}, ${membersInChannel[0]}! Foi um prazer ajudar. Até logo!`;
      } else if (membersInChannel.length > 1) {
        const names = membersInChannel.join(', ');
        farewell = `${greeting} a todos! ${names}, foi um prazer estar com vocês. Até logo!`;
      } else {
        farewell = `${greeting}! Até logo!`;
      }

      console.log('[Sayuri] Desconectando:', farewell);

      await sendToMainChannel(client, `
🚪 **[VOZ ENCERRADA]** ${new Date().toLocaleString('pt-BR')}
👤 **Solicitado por:** ${member?.user.username}
💬 **Despedida:** "${farewell}"
`.trim());

      await speakText(farewell, player);
      await new Promise(resolve => setTimeout(resolve, 500));

      clearTimeout(activeModeTimer);
      connection.destroy();
    }

    receiver.speaking.on('start', async (speakingUserId) => {
      if (!ALLOWED_IDS.includes(speakingUserId)) return;

      const member = voice.guild.members.cache.get(speakingUserId);
      if (member?.voice.selfMute || member?.voice.serverMute) return;
      if (processingUsers.has(speakingUserId)) return;

      const now = Date.now();
      const last = lastSpoke.get(speakingUserId) ?? 0;
      if (now - last < 2000) return;
      if (player.state.status === AudioPlayerStatus.Playing) return;

      processingUsers.add(speakingUserId);
      lastSpoke.set(speakingUserId, now);

      const pcmFile = `./tmp/audio_${speakingUserId}_${Date.now()}.pcm`;
      const wavFile = pcmFile.replace('.pcm', '.wav');

      const opusStream = receiver.subscribe(speakingUserId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 1200 }
      });

      const decoder = new prism.opus.Decoder({
        frameSize: 960, channels: 1, rate: 16000,
      });

      const writeStream = fs.createWriteStream(pcmFile);

      try {
        await pipelineAsync(opusStream, decoder, writeStream);

        const stat = fs.statSync(pcmFile);
        if (stat.size < 8000) {
          console.log('[Sayuri] Áudio curto demais, ignorando.');
          return;
        }

        await convertPcmToWav(pcmFile, wavFile);
        const transcribed = await transcribe(wavFile);

        if (!transcribed || transcribed.length < 3) return;

        const lower = transcribed.toLowerCase();
        const isNoise = IGNORE_PHRASES.some(p => lower.includes(p));
        if (isNoise) {
          console.log('[Sayuri] Ruído detectado, ignorando.');
          return;
        }

        updateUserProfile(speakingUserId, member?.user.username ?? 'Desconhecido');

        if (!activeMode) {
          if (!containsWakeWord(transcribed)) {
            console.log('[Sayuri] Inativa — ignorando:', transcribed);

            saveConversation({
              userId: speakingUserId,
              username: member?.user.username ?? 'Desconhecido',
              channel: 'voice',
              type: 'voice',
              transcribed,
              cleanText: transcribed,
              response: 'Inativa — wake word não detectada',
              wakeWordDetected: false,
            });

            const firstWord = transcribed.split(' ')[0]?.toLowerCase().trim();
            if (firstWord && firstWord.length > 2) learnWakeWord(firstWord);
            return;
          }

          activateSayuri(15000);
        }

        console.log('[Sayuri] Transcrito:', transcribed);

        // Remove a wake word para analisar o comando
        const cleanText = transcribed
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/sa[iy]u?r[iei]?s?|sa[iy]ur?|sa\s?uri|seuri|seyuri|chauri|xauri|shauri|zauri/gi, '')
          .trim();

        console.log('[Sayuri] Texto limpo:', cleanText);

        // Comando: kick de membro
        if (containsKickVoiceCommand(cleanText)) {
          const targetMember = await findMemberByName(voice.guild, cleanText);

          console.log('[Sayuri] Membro encontrado:', targetMember?.user.username ?? 'nenhum');

          if (!targetMember) {
            await speakText('Não encontrei esse membro na chamada.', player);
            activateSayuri(15000);
            return;
          }

          if (targetMember.user.bot) {
            await disconnectSayuri(member);
            return;
          }

          if (!targetMember.voice.channel) {
            await speakText(`${targetMember.user.username} não está em nenhum canal de voz.`, player);
            activateSayuri(15000);
            return;
          }

          try {
            console.log('[Sayuri] Tentando desconectar:', targetMember.user.username);
            await targetMember.voice.setChannel(null);

            const greeting = getGreetingByTime();
            const farewell = `${targetMember.user.username} foi desconectado da chamada. ${greeting}!`;

            console.log('[Sayuri] Desconectado com sucesso:', targetMember.user.username);

            await sendToMainChannel(client, `
🔌 **[KICK DE VOZ]** ${new Date().toLocaleString('pt-BR')}
👤 **Solicitado por:** ${member?.user.username}
🎯 **Desconectado:** ${targetMember.user.username}
`.trim());

            await speakText(farewell, player);

          } catch (err) {
            console.error('[Sayuri] Erro ao desconectar membro:', err.message);
            await speakText('Não tenho permissão para desconectar esse membro.', player);
          }

          activateSayuri(15000);
          return;
        }

        // Comando: Sayuri sai da call (só se tiver comando explícito DEPOIS da wake word)
        if (containsDisconnectCommand(cleanText) && cleanText.length > 0) {
          console.log('[Sayuri] Comando de desconexão detectado!');
          await disconnectSayuri(member);
          return;
        }

        // Pergunta normal
        console.log(`[Sayuri] Processando pergunta: "${cleanText}"`);

        let serverData = '';
        try {
          serverData = await saveServerData(client, TARGET_GUILD_ID);
        } catch {
          try {
            serverData = fs.readFileSync('./db/server-context.txt', 'utf-8');
          } catch {
            serverData = 'Dados do servidor não disponíveis.';
          }
        }

        const userMessageWithContext = `
[CONTEXTO DO SERVIDOR - USE APENAS ESSES DADOS]:
${serverData}
[PERGUNTA]: ${cleanText}
`.trim();

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `Você é a Sayuri, assistente de voz do servidor Discord.
REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base no CONTEXTO DO SERVIDOR fornecido na mensagem
2. NUNCA invente dados, membros, números ou informações externas
3. Se a informação não estiver no contexto, diga: "Não tenho essa informação"
4. Responda em português, de forma MUITO curta (máximo 2 frases)
5. Números e nomes devem ser EXATAMENTE iguais aos do contexto`
              },
              { role: 'user', content: userMessageWithContext }
            ],
            max_tokens: 100,
            temperature: 0.0,
            top_p: 0.1
          })
        });

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content ?? 'Não entendi, pode repetir?';

        activateSayuri(15000);

        console.log(`[Sayuri] Respondendo: "${reply}"`);

        saveConversation({
          userId: speakingUserId,
          username: member?.user.username ?? 'Desconhecido',
          channel: 'voice',
          type: 'voice',
          transcribed,
          cleanText,
          response: reply,
          wakeWordDetected: true,
        });

        await sendToMainChannel(client, `
🎙️ **[VOZ]** ${new Date().toLocaleString('pt-BR')}
👤 **Usuário:** ${member?.user.username}
❓ **Disse:** "${transcribed}"
🤖 **Sayuri:** ${reply}
`.trim());

        await speakText(reply, player);

      } catch (err) {
        console.error('[Sayuri] Erro:', err.message);
      } finally {
        processingUsers.delete(speakingUserId);
        fs.unlink(pcmFile, () => {});
        fs.unlink(wavFile, () => {});
        fs.unlink(wavFile + '.txt', () => {});
      }
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
      if (newState.channelId !== voice.id && oldState.channelId !== voice.id) return;
      const username = newState.member?.user.username;
      if (!username) return;

      if (newState.channelId === voice.id && oldState.channelId !== voice.id) {
        sendToMainChannel(client, `👋 **[ENTRADA]** **${username}** entrou no canal **${voice.name}** — ${new Date().toLocaleString('pt-BR')}`);
      }
      if (!newState.channelId && oldState.channelId === voice.id) {
        sendToMainChannel(client, `🚪 **[SAÍDA]** **${username}** saiu do canal **${voice.name}** — ${new Date().toLocaleString('pt-BR')}`);
      }
    });
  });
}

function speakText(text, player) {
  return new Promise((resolve, reject) => {
    const filename = `./tmp/tts_${Date.now()}.mp3`;
    const tts = new gtts(text, 'pt');

    tts.save(filename, (err) => {
      if (err) return reject(err);

      const resource = createAudioResource(filename);
      player.play(resource);

      player.once(AudioPlayerStatus.Idle, () => {
        fs.unlink(filename, () => {});
        resolve();
      });

      setTimeout(() => {
        fs.unlink(filename, () => {});
        resolve();
      }, 30_000);
    });
  });
}

function convertPcmToWav(pcmFile, wavFile) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-f', 's16le', '-ar', '16000', '-ac', '1',
      '-i', pcmFile, wavFile
    ]);
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg código ${code}`)));
    ffmpeg.on('error', reject);
  });
}

function transcribe(wavFile) {
  return new Promise((resolve, reject) => {
    const proc = spawn(WHISPER_BIN, [
      '--model', WHISPER_MODEL,
      '--language', 'pt',
      '--output-txt',
      '--no-timestamps',
      wavFile
    ]);

    let output = '';
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', () => {});

    proc.on('close', code => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`whisper-cli código ${code}`));
    });

    proc.on('error', reject);
  });
}