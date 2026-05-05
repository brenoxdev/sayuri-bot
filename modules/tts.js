import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
  } from '@discordjs/voice';
  import gtts from 'gtts';
  import fs from 'fs';
  
  export let voiceConnection = null;
  export const audioPlayer = createAudioPlayer();
  
  export async function joinChannel(channel) {
    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
  
    await entersState(voiceConnection, VoiceConnectionStatus.Ready, 10_000);
    voiceConnection.subscribe(audioPlayer);
    return voiceConnection;
  }
  
  export async function speak(text, lang = 'pt') {
    return new Promise((resolve, reject) => {
      const filename = `./tmp/tts_${Date.now()}.mp3`;
      const tts = new gtts(text, lang);
  
      tts.save(filename, (err) => {
        if (err) return reject(err);
  
        const resource = createAudioResource(filename);
        audioPlayer.play(resource);
  
        audioPlayer.once(AudioPlayerStatus.Idle, () => {
          fs.unlink(filename, () => {});
          resolve();
        });
      });
    });
  }
  
  // Handler do comando /falar
  export function setupTTS(client) {
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'falar') return;
  
      const voice = interaction.member?.voice.channel;
      if (!voice) {
        return interaction.reply({ content: '❌ Entre em um canal de voz primeiro!', ephemeral: true });
      }
  
      const texto = interaction.options.getString('texto');
      await interaction.reply(`🔊 Falando: *${texto}*`);
  
      try {
        await joinChannel(voice);
        await speak(texto);
      } catch (err) {
        console.error('[TTS]', err);
      }
    });
  }