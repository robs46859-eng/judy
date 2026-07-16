/**
 * Minimal WAV (RIFF/PCM) container writer. Several TTS providers (including
 * ElevenLabs) return raw headerless PCM samples rather than a playable file
 * — Rhubarb Lip Sync needs an actual WAV file on disk, so this wraps raw PCM
 * bytes in the standard 44-byte RIFF header. Pure and dependency-free, so
 * it's fully unit-testable without any audio library.
 */

export interface WavOptions {
  sampleRate: number;
  numChannels?: number;
  bitsPerSample?: number;
}

export function wrapPcmAsWav(pcm: Buffer, options: WavOptions): Buffer {
  const numChannels = options.numChannels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const sampleRate = options.sampleRate;

  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}
