import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  runTravelTranslation: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/hermes/translation-runner', () => ({
  runTravelTranslation: mocks.runTravelTranslation,
}));

import { prepareSpeechForUser, SPEECH_TRANSLATION_BUDGET_MS } from '../speech-preparation';

beforeEach(() => {
  mocks.findUnique.mockReset();
  mocks.runTravelTranslation.mockReset();
});

describe('prepareSpeechForUser', () => {
  it('translates only the spoken copy and chooses a compatible saved voice', async () => {
    mocks.findUnique.mockResolvedValue({ voiceId: 'travel-daddy-classic-es', spokenLanguage: 'es-ES' });
    mocks.runTravelTranslation.mockResolvedValue({
      translatedText: 'Lleva un impermeable.',
      targetLanguage: 'Spanish',
    });

    const prepared = await prepareSpeechForUser(new Headers(), 'user-a', {
      text: 'Pack a raincoat.',
      replyLanguage: 'en-US',
    });

    expect(prepared).toEqual({
      text: 'Lleva un impermeable.',
      language: 'es-ES',
      voiceId: 'travel-daddy-classic-es',
      translated: true,
    });
    expect(mocks.runTravelTranslation).toHaveBeenCalledWith(
      expect.any(Headers),
      'user-a',
      { text: 'Pack a raincoat.', targetLanguage: 'Spanish', sourceLanguage: 'English' },
      SPEECH_TRANSLATION_BUDGET_MS
    );
  });

  it('does not translate when the displayed reply is already in the selected spoken language', async () => {
    mocks.findUnique.mockResolvedValue({ voiceId: 'travel-daddy-classic-es', spokenLanguage: 'es-MX' });

    const prepared = await prepareSpeechForUser(new Headers(), 'user-a', {
      text: 'Lleva un impermeable.',
      replyLanguage: 'es-ES',
    });

    expect(prepared.text).toBe('Lleva un impermeable.');
    expect(prepared.language).toBe('es-MX');
    expect(prepared.voiceId).toBe('travel-daddy-classic-es');
    expect(prepared.translated).toBe(false);
    expect(mocks.runTravelTranslation).not.toHaveBeenCalled();
  });

  it('keeps the original locale and compatible fallback voice when translation is unavailable', async () => {
    mocks.findUnique.mockResolvedValue({ voiceId: 'travel-daddy-classic-es', spokenLanguage: 'es-ES' });
    mocks.runTravelTranslation.mockResolvedValue(null);

    const prepared = await prepareSpeechForUser(new Headers(), 'user-a', {
      text: 'Pack a raincoat.',
      replyLanguage: 'en-US',
    });

    expect(prepared).toEqual({
      text: 'Pack a raincoat.',
      language: 'en-US',
      voiceId: 'travel-daddy-classic-en',
      translated: false,
    });
  });

  it('fails open to the original reply when preferences or translation are unavailable', async () => {
    mocks.findUnique.mockRejectedValue(new Error('database unavailable'));

    const prepared = await prepareSpeechForUser(new Headers(), 'user-a', { text: 'Pack a raincoat.' });

    expect(prepared).toEqual({
      text: 'Pack a raincoat.',
      language: 'en-US',
      voiceId: 'travel-daddy-classic-en',
      translated: false,
    });
    expect(mocks.runTravelTranslation).not.toHaveBeenCalled();
  });
});
