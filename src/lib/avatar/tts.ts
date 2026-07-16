import 'server-only';

/**
 * Speech synthesis provider interface (Swarm J7, stage 2 — scaffold).
 *
 * No TTS provider is chosen/configured yet — this file exists so the rest of
 * the lip-sync pipeline (Rhubarb invocation, the /api/avatar/lipsync route)
 * can be built and tested against a stable interface now, and wiring in a
 * real provider later is a small, isolated change confined to this file.
 *
 * Whatever provider gets chosen MUST return real WAV audio (16-bit PCM) —
 * Rhubarb Lip Sync analyzes the waveform itself, so no viseme/timing data is
 * needed from the TTS provider. Common providers (Google Cloud TTS, Amazon
 * Polly, Azure Speech, ElevenLabs) all support a WAV/LINEAR16 output format;
 * pick whichever fits existing infra/budget and set `TTS_PROVIDER` +
 * whatever credential it needs, then implement `synthesizeSpeech` below.
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
}

export class TtsNotConfiguredError extends Error {
  constructor() {
    super('No TTS provider is configured (TTS_PROVIDER unset) — speech synthesis unavailable.');
    this.name = 'TtsNotConfiguredError';
  }
}

/**
 * Synthesizes speech audio for the given text/language. Throws
 * `TtsNotConfiguredError` until a real provider is wired up — callers must
 * treat that as a normal, expected "feature not available yet" outcome (same
 * fail-open philosophy as every other optional integration in this app), not
 * a server error.
 */
export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizedSpeech> {
  void input; // unused until a provider is wired in — kept named for the call-site signature
  throw new TtsNotConfiguredError();
}
