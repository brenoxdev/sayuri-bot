import { EndBehaviorType } from '@discordjs/voice';
import prism from 'prism-media';
import fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { setMaxListeners } from 'events';
setMaxListeners(20);

const pipelineAsync = promisify(pipeline);

const WHISPER_BIN = `${process.env.HOME}/whisper.cpp/build/bin/whisper-cli`;
const WHISPER_MODEL = `${process.env.HOME}/whisper.cpp/models/ggml-base.bin`;

export function listenToUser(connection, userId, onTranscription) {
  const receiver = connection.receiver;

  receiver.speaking.on('start', async (speakingUserId) => {
    if (speakingUserId !== userId) return;

    const pcmFile = `./tmp/audio_${userId}_${Date.now()}.pcm`;
    const wavFile = pcmFile.replace('.pcm', '.wav');

    const opusStream = receiver.subscribe(speakingUserId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      }
    });

    const decoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 1,
      rate: 16000,
    });

    const writeStream = fs.createWriteStream(pcmFile);

    try {
      await pipelineAsync(opusStream, decoder, writeStream);
      await convertPcmToWav(pcmFile, wavFile);
      const text = await transcribe(wavFile);

      if (text) {
        console.log(`[STT] Transcrito: "${text}"`);
        onTranscription(text, speakingUserId);
      }

    } catch (err) {
      console.error('[STT]', err.message);
    } finally {
      fs.unlink(pcmFile, () => {});
      fs.unlink(wavFile, () => {});
      fs.unlink(wavFile + '.txt', () => {});
    }
  });
}

function convertPcmToWav(pcmFile, wavFile) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 's16le',
      '-ar', '16000',
      '-ac', '1',
      '-i', pcmFile,
      wavFile
    ]);
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg erro código ${code}`)));
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
      else reject(new Error(`whisper-cli saiu com código ${code}`));
    });

    proc.on('error', reject);
  });
}