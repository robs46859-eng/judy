import { describe, it, expect } from 'vitest';
import { wrapPcmAsWav } from '../wav';

describe('wrapPcmAsWav', () => {
  it('produces a 44-byte RIFF/WAVE header followed by the PCM data unmodified', () => {
    const pcm = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const wav = wrapPcmAsWav(pcm, { sampleRate: 24000 });

    expect(wav.length).toBe(44 + pcm.length);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.subarray(12, 16).toString('ascii')).toBe('fmt ');
    expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
    expect(wav.subarray(44)).toEqual(pcm);
  });

  it('writes the correct RIFF chunk size (36 + data length)', () => {
    const pcm = Buffer.alloc(100);
    const wav = wrapPcmAsWav(pcm, { sampleRate: 24000 });
    expect(wav.readUInt32LE(4)).toBe(36 + 100);
  });

  it('writes the correct data subchunk size', () => {
    const pcm = Buffer.alloc(250);
    const wav = wrapPcmAsWav(pcm, { sampleRate: 24000 });
    expect(wav.readUInt32LE(40)).toBe(250);
  });

  it('defaults to mono 16-bit PCM', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(10), { sampleRate: 22050 });
    expect(wav.readUInt16LE(20)).toBe(1); // AudioFormat = PCM
    expect(wav.readUInt16LE(22)).toBe(1); // NumChannels = 1
    expect(wav.readUInt16LE(34)).toBe(16); // BitsPerSample
  });

  it('honors an explicit channel count and bit depth', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(10), {
      sampleRate: 44100,
      numChannels: 2,
      bitsPerSample: 8,
    });
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt16LE(34)).toBe(8);
  });

  it('computes byteRate and blockAlign correctly', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(10), {
      sampleRate: 24000,
      numChannels: 1,
      bitsPerSample: 16,
    });
    // blockAlign = numChannels * bitsPerSample/8 = 1 * 2 = 2
    expect(wav.readUInt16LE(32)).toBe(2);
    // byteRate = sampleRate * blockAlign = 24000 * 2 = 48000
    expect(wav.readUInt32LE(28)).toBe(48000);
  });

  it('writes the given sample rate', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(4), { sampleRate: 16000 });
    expect(wav.readUInt32LE(24)).toBe(16000);
  });

  it('handles empty PCM data without throwing', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(0), { sampleRate: 24000 });
    expect(wav.length).toBe(44);
    expect(wav.readUInt32LE(40)).toBe(0);
  });
});
