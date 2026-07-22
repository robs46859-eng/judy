import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { synthesizeSpeech, TtsNotConfiguredError } from '../tts';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
  delete process.env.TTS_PROVIDER;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_ID;
  delete process.env.ELEVENLABS_MODEL_ID;
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('ELEVENLABS_VOICE_')) delete process.env[key];
  }
}

beforeEach(() => {
  resetEnv();
});

afterEach(() => {
  resetEnv();
  vi.unstubAllGlobals();
});

describe('synthesizeSpeech', () => {
  it('throws TtsNotConfiguredError when TTS_PROVIDER is unset', async () => {
    await expect(synthesizeSpeech({ text: 'hi', language: 'en-US' })).rejects.toBeInstanceOf(
      TtsNotConfiguredError
    );
  });

  it('throws TtsNotConfiguredError for an unrecognized provider name', async () => {
    process.env.TTS_PROVIDER = 'not-a-real-provider';
    await expect(synthesizeSpeech({ text: 'hi', language: 'en-US' })).rejects.toBeInstanceOf(
      TtsNotConfiguredError
    );
  });

  describe('elevenlabs provider', () => {
    beforeEach(() => {
      process.env.TTS_PROVIDER = 'elevenlabs';
    });

    it('throws TtsNotConfiguredError when the API key or voice id is missing', async () => {
      await expect(synthesizeSpeech({ text: 'hi', language: 'en-US' })).rejects.toBeInstanceOf(
        TtsNotConfiguredError
      );

      process.env.ELEVENLABS_API_KEY = 'key';
      await expect(synthesizeSpeech({ text: 'hi', language: 'en-US' })).rejects.toBeInstanceOf(
        TtsNotConfiguredError
      );
    });

    it('returns WAV audio built from the raw PCM ElevenLabs returns', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.ELEVENLABS_VOICE_ID = 'voice-123';

      const pcmBytes = new Uint8Array([1, 2, 3, 4]);
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => pcmBytes.buffer,
      }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await synthesizeSpeech({ text: 'Pack a raincoat', language: 'en-US' });

      expect(result.mimeType).toBe('audio/wav');
      expect(result.audio.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(result.audio.subarray(44)).toEqual(Buffer.from(pcmBytes));

      const [url, requestInit] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('voice-123');
      expect(String(url)).toContain('output_format=pcm_24000');
      expect(requestInit.headers['xi-api-key']).toBe('test-key');
      expect(JSON.parse(requestInit.body).text).toBe('Pack a raincoat');
      expect(JSON.parse(requestInit.body).model_id).toBe('eleven_flash_v2_5');
    });

    it('uses ELEVENLABS_MODEL_ID when set instead of the default', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.ELEVENLABS_VOICE_ID = 'voice-123';
      process.env.ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(0),
      }));
      vi.stubGlobal('fetch', fetchMock);

      await synthesizeSpeech({ text: 'hi', language: 'en-US' });

      const [, requestInit] = fetchMock.mock.calls[0];
      expect(JSON.parse(requestInit.body).model_id).toBe('eleven_flash_v2_5');
    });

    it('uses a configured catalog voice before the global provider fallback', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.ELEVENLABS_VOICE_ID = 'default-voice';
      process.env.ELEVENLABS_VOICE_TRAVEL_DADDY_CLASSIC_ES = 'spanish-voice';
      const fetchMock = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }));
      vi.stubGlobal('fetch', fetchMock);

      await synthesizeSpeech({
        text: 'Lleva un impermeable.',
        language: 'es-ES',
        voiceId: 'travel-daddy-classic-es',
      });

      expect(String(fetchMock.mock.calls[0][0])).toContain('spanish-voice');
    });

    it('throws a plain Error (not TtsNotConfiguredError) when the ElevenLabs request fails', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.ELEVENLABS_VOICE_ID = 'voice-123';

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, status: 401, text: async () => 'unauthorized' }))
      );

      await expect(synthesizeSpeech({ text: 'hi', language: 'en-US' })).rejects.toThrow(
        /ElevenLabs TTS request failed/
      );
    });
  });
});
