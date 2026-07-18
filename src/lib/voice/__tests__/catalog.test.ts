import { describe, it, expect } from 'vitest';
import {
  APPROVED_VOICES,
  APPROVED_VOICE_IDS,
  DEFAULT_VOICE_ID,
  getVoicesForLanguage,
  isApprovedVoiceId,
  isVoiceCompatibleWithLanguage,
  getVoiceOption,
  getTranslationLanguageName,
  isSupportedSpokenLanguage,
  languagesMatch,
  normalizeVoiceLocale,
  selectVoiceForLanguage,
} from '../catalog';

describe('voice catalog (Swarm J5)', () => {
  it('exposes a rich catalog with complete locale and personality metadata', () => {
    expect(APPROVED_VOICES.length).toBeGreaterThanOrEqual(12);
    for (const voice of APPROVED_VOICES) {
      expect(voice.id.length).toBeGreaterThan(0);
      expect(voice.label.length).toBeGreaterThan(0);
      expect(voice.language.length).toBeGreaterThan(0);
      expect(voice.locale).toBe(Intl.getCanonicalLocales(voice.locale)[0]);
      expect(voice.personality.length).toBeGreaterThan(0);
    }
  });

  it('preserves every original voice id and its existing display behavior', () => {
    expect(getVoiceOption('travel-daddy-classic-en')).toMatchObject({
      label: 'Classic (English)',
      language: 'English',
    });
    expect(getVoiceOption('travel-daddy-warm-en')).toMatchObject({
      label: 'Warm (English)',
      language: 'English',
    });
    expect(getVoiceOption('travel-daddy-classic-es')).toMatchObject({
      label: 'Clásico (Español)',
      language: 'Spanish',
    });
    expect(DEFAULT_VOICE_ID).toBe('travel-daddy-classic-en');
  });

  it('does not contain duplicate voice ids', () => {
    expect(new Set(APPROVED_VOICE_IDS).size).toBe(APPROVED_VOICE_IDS.length);
  });

  it('APPROVED_VOICE_IDS matches the ids in APPROVED_VOICES', () => {
    expect(APPROVED_VOICE_IDS).toEqual(APPROVED_VOICES.map((v) => v.id));
  });

  describe('isApprovedVoiceId', () => {
    it('accepts every id in the catalog', () => {
      for (const id of APPROVED_VOICE_IDS) {
        expect(isApprovedVoiceId(id)).toBe(true);
      }
    });

    it('rejects an arbitrary provider voice id not in the catalog', () => {
      expect(isApprovedVoiceId('some-random-heygen-voice-id')).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(isApprovedVoiceId('')).toBe(false);
    });
  });

  describe('getVoiceOption', () => {
    it('returns the matching voice option for a known id', () => {
      const [first] = APPROVED_VOICES;
      expect(getVoiceOption(first.id)).toEqual(first);
    });

    it('returns null for an unknown id', () => {
      expect(getVoiceOption('not-a-real-voice')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
      expect(getVoiceOption(null)).toBeNull();
      expect(getVoiceOption(undefined)).toBeNull();
    });
  });

  describe('normalizeVoiceLocale', () => {
    it.each([
      ['English', 'en'],
      ['Español', 'es'],
      ['Français', 'fr'],
      ['Portuguese (Brazil)', 'pt-BR'],
      ['es_mx', 'es-MX'],
      ['EN-gb', 'en-GB'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizeVoiceLocale(input)).toBe(expected);
    });

    it('returns null for missing or unknown free-form language names', () => {
      expect(normalizeVoiceLocale(null)).toBeNull();
      expect(normalizeVoiceLocale('')).toBeNull();
      expect(normalizeVoiceLocale('Klingon')).toBeNull();
    });
  });

  it('exposes only supported settings languages and translation display names', () => {
    expect(isSupportedSpokenLanguage('es-MX')).toBe(true);
    expect(isSupportedSpokenLanguage('Klingon')).toBe(false);
    expect(getTranslationLanguageName('es-MX')).toBe('Spanish');
    expect(languagesMatch('es-ES', 'es-MX')).toBe(true);
    expect(languagesMatch('es-ES', 'fr-FR')).toBe(false);
  });

  describe('language-aware selection', () => {
    it('prefers a requested voice when it supports the spoken language', () => {
      expect(selectVoiceForLanguage('travel-daddy-warm-en', 'en-GB').id).toBe(
        'travel-daddy-warm-en'
      );
      expect(
        isVoiceCompatibleWithLanguage(
          getVoiceOption('travel-daddy-warm-en')!,
          'English'
        )
      ).toBe(true);
    });

    it('replaces an incompatible requested voice with a language match', () => {
      expect(selectVoiceForLanguage('travel-daddy-warm-en', 'Spanish').id).toBe(
        'travel-daddy-classic-es'
      );
    });

    it('prefers an exact locale when no compatible voice was requested', () => {
      expect(selectVoiceForLanguage(null, 'es-MX').id).toBe('judy-warm-es-mx');
      expect(getVoicesForLanguage('fr-CA').map((voice) => voice.id)).toEqual([
        'judy-friendly-fr-ca',
        'judy-elegant-fr',
      ]);
    });

    it('uses the original default for an unsupported language', () => {
      expect(selectVoiceForLanguage('travel-daddy-classic-es', 'Klingon').id).toBe(
        DEFAULT_VOICE_ID
      );
      expect(getVoicesForLanguage('Klingon')).toEqual([]);
    });

    it('preserves a valid saved voice until a spoken language is selected', () => {
      expect(selectVoiceForLanguage('travel-daddy-classic-es', null).id).toBe(
        'travel-daddy-classic-es'
      );
    });

    it('uses the original default when neither selection is usable', () => {
      expect(selectVoiceForLanguage('not-a-real-voice', null).id).toBe(DEFAULT_VOICE_ID);
    });
  });
});
