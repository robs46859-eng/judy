import 'server-only';

import { wrapPcmAsWav } from './wav';
import { getElevenLabsVoiceEnvKey, selectVoiceForLanguage } from '@/lib/voice/catalog';

/**
 * Speech synthesis provider interface (Swarm J7/J8).
 *
 * Rhubarb Lip Sync analyzes the WAV waveform itself, so no viseme/timing
 * data is needed from whichever TTS provider is selected — only real audio.
 * Provider selection is env-driven (`TTS_PROVIDER`) so adding another one
 * later means adding a branch here, not redesigning callers.
 */

export interface SynthesizedSpeech {
  /** 16-bit PCM WAV audio bytes. */
  audio: Buffer;
  /** Always 'audio/wav' today — Rhubarb needs WAV, not MP3/Opus/etc. */
  mimeType: 'audio/wav';
}

export interface SynthesizeSpeechInput {
  text: string;
  /** BCP-47-ish language/voice hint, e.g. "en-US", "es-ES". */
  language: string;
  /** Server-approved logical voice ID, never an ElevenLabs ID from the client. */
  voiceId?: string;
}

export class TtsNotConfiguredError extends Error {
  constructor(message = 'No TTS provider is configured (TTS_PROVIDER unset) — speech synthesis unavailable.') {
    super(message);
    this.name = 'TtsNotConfiguredError';
  }
}

const ELEVENLABS_SAMPLE_RATE = 24_000;
const ELEVENLABS_DEFAULT_MODEL = 'eleven_flash_v2_5';

/**
 * ElevenLabs Text-to-Speech (https://elevenlabs.io/docs/api-reference/text-to-speech).
 * Requests raw 16-bit PCM (output_format=pcm_24000) rather than the default
 * MP3 — Rhubarb needs an uncompressed waveform, and this avoids pulling in
 * an MP3 decoder/ffmpeg just to get audio Rhubarb can read. Flash v2.5 keeps
 * Judy's multilingual speech path while minimizing interactive TTS latency.
 */
async function synthesizeWithElevenLabs(input: SynthesizeSpeechInput): Promise<SynthesizedSpeech> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const selectedVoice = selectVoiceForLanguage(input.voiceId, input.language);
  const voiceId = process.env[getElevenLabsVoiceEnvKey(selectedVoice.id)] || process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || ELEVENLABS_DEFAULT_MODEL;

  if (!apiKey || !voiceId) {
    throw new TtsNotConfiguredError(
      'TTS_PROVIDER=elevenlabs requires ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.'
    );
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=pcm_${ELEVENLABS_SAMPLE_RATE}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: input.text,
        model_id: modelId,
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS request failed (${res.status}): ${errBody.slice(0, 500)}`);
  }

  const pcm = Buffer.from(await res.arrayBuffer());
  const audio = wrapPcmAsWav(pcm, { sampleRate: ELEVENLABS_SAMPLE_RATE, numChannels: 1, bitsPerSample: 16 });
  return { audio, mimeType: 'audio/wav' };
}

/**
 * Synthesizes speech audio for the given text/language using whichever
 * provider `TTS_PROVIDER` selects. Throws `TtsNotConfiguredError` when no
 * provider is selected/configured — callers must treat that as a normal,
 * expected "feature not available yet" outcome (same fail-open philosophy
 * as every other optional integration in this app), not a server error.
 */
export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizedSpeech> {
  const provider = (process.env.TTS_PROVIDER || '').trim().toLowerCase();

  switch (provider) {
    case 'elevenlabs':
      return synthesizeWithElevenLabs(input);
    case '':
      throw new TtsNotConfiguredError();
    default:
      throw new TtsNotConfiguredError(`Unknown TTS_PROVIDER "${provider}".`);
  }
}
