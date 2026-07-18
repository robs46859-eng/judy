/**
 * Server-approved voice catalog (Swarm J5).
 *
 * The client may only ever pick from this list — never an arbitrary
 * provider voice ID. `PATCH /api/user/preferences` validates against
 * `APPROVED_VOICE_IDS` via zod, so a request naming anything else is
 * rejected outright, the same way unknown preference fields are.
 *
 * These IDs are application-level preferences, not provider IDs. Server-side
 * provider adapters resolve an optional per-voice environment variable and
 * otherwise safely fall back to the configured default provider voice.
 */

export interface VoiceOption {
  id: string;
  label: string;
  /** English display name used by existing preference and onboarding flows. */
  language: string;
  /** BCP-47 locale used to choose an appropriate speech voice. */
  locale: string;
  /** Short, user-facing description of the voice's character. */
  personality: string;
}

export const APPROVED_VOICES: readonly VoiceOption[] = [
  {
    id: 'travel-daddy-classic-en',
    label: 'Classic (English)',
    language: 'English',
    locale: 'en-US',
    personality: 'Classic and composed',
  },
  {
    id: 'travel-daddy-warm-en',
    label: 'Warm (English)',
    language: 'English',
    locale: 'en-US',
    personality: 'Warm and reassuring',
  },
  {
    id: 'travel-daddy-classic-es',
    label: 'Clásico (Español)',
    language: 'Spanish',
    locale: 'es-ES',
    personality: 'Calm and polished',
  },
  {
    id: 'judy-bright-en-gb',
    label: 'Bright (English — UK)',
    language: 'English',
    locale: 'en-GB',
    personality: 'Bright and polished',
  },
  {
    id: 'judy-warm-es-mx',
    label: 'Cálida (Español — México)',
    language: 'Spanish',
    locale: 'es-MX',
    personality: 'Warm and lively',
  },
  {
    id: 'judy-elegant-fr',
    label: 'Élégante (Français)',
    language: 'French',
    locale: 'fr-FR',
    personality: 'Elegant and attentive',
  },
  {
    id: 'judy-friendly-fr-ca',
    label: 'Amicale (Français — Canada)',
    language: 'French',
    locale: 'fr-CA',
    personality: 'Friendly and relaxed',
  },
  {
    id: 'judy-confident-de',
    label: 'Souverän (Deutsch)',
    language: 'German',
    locale: 'de-DE',
    personality: 'Confident and clear',
  },
  {
    id: 'judy-lively-it',
    label: 'Vivace (Italiano)',
    language: 'Italian',
    locale: 'it-IT',
    personality: 'Lively and expressive',
  },
  {
    id: 'judy-sunny-pt-br',
    label: 'Ensolarada (Português — Brasil)',
    language: 'Portuguese',
    locale: 'pt-BR',
    personality: 'Sunny and conversational',
  },
  {
    id: 'judy-calm-pt-pt',
    label: 'Serena (Português — Portugal)',
    language: 'Portuguese',
    locale: 'pt-PT',
    personality: 'Calm and thoughtful',
  },
  {
    id: 'judy-gentle-ja',
    label: '穏やか (Japanese)',
    language: 'Japanese',
    locale: 'ja-JP',
    personality: 'Gentle and considerate',
  },
  {
    id: 'judy-clear-ko',
    label: '명료함 (Korean)',
    language: 'Korean',
    locale: 'ko-KR',
    personality: 'Clear and welcoming',
  },
  {
    id: 'judy-bright-zh',
    label: '明快 (Mandarin Chinese)',
    language: 'Mandarin Chinese',
    locale: 'zh-CN',
    personality: 'Bright and helpful',
  },
  {
    id: 'judy-warm-ar',
    label: 'دافئة (Arabic)',
    language: 'Arabic',
    locale: 'ar-SA',
    personality: 'Warm and gracious',
  },
  {
    id: 'judy-friendly-hi',
    label: 'मिलनसार (Hindi)',
    language: 'Hindi',
    locale: 'hi-IN',
    personality: 'Friendly and upbeat',
  },
  {
    id: 'judy-relaxed-nl',
    label: 'Ontspannen (Nederlands)',
    language: 'Dutch',
    locale: 'nl-NL',
    personality: 'Relaxed and practical',
  },
] as const;

export const APPROVED_VOICE_IDS: readonly string[] = APPROVED_VOICES.map((v) => v.id);

/** Keep the original first voice as the safe fallback for existing users. */
export const DEFAULT_VOICE_ID = 'travel-daddy-classic-en';

const DEFAULT_VOICE = APPROVED_VOICES.find((voice) => voice.id === DEFAULT_VOICE_ID)!;

export interface SpokenLanguageOption {
  locale: string;
  label: string;
  translationLanguage: string;
}

/** One clear language choice for the settings UI, using the first catalog locale. */
export const SPOKEN_LANGUAGE_OPTIONS: readonly SpokenLanguageOption[] = Array.from(
  new Map(
    APPROVED_VOICES.map((voice) => [
      voice.language,
      { locale: voice.locale, label: voice.language, translationLanguage: voice.language },
    ])
  ).values()
);

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  english: 'en',
  'english (us)': 'en-US',
  'english (uk)': 'en-GB',
  spanish: 'es',
  espanol: 'es',
  'spanish (mexico)': 'es-MX',
  french: 'fr',
  francais: 'fr',
  'french (canada)': 'fr-CA',
  german: 'de',
  deutsch: 'de',
  italian: 'it',
  italiano: 'it',
  portuguese: 'pt',
  portugues: 'pt',
  'portuguese (brazil)': 'pt-BR',
  'portuguese (portugal)': 'pt-PT',
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh',
  mandarin: 'zh',
  'mandarin chinese': 'zh',
  arabic: 'ar',
  hindi: 'hi',
  dutch: 'nl',
  nederlands: 'nl',
};

function normalizedLookupKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Converts catalog language names and BCP-47-ish tags to a canonical locale.
 * Unknown free-form names return null rather than being guessed.
 */
export function normalizeVoiceLocale(languageOrLocale: string | null | undefined): string | null {
  const trimmed = languageOrLocale?.trim();
  if (!trimmed) return null;

  const alias = LANGUAGE_ALIASES[normalizedLookupKey(trimmed)];
  const candidate = (alias ?? trimmed).replaceAll('_', '-');

  try {
    const canonical = Intl.getCanonicalLocales(candidate)[0] ?? null;
    if (!canonical) return null;

    const supportedLanguages = new Set(
      APPROVED_VOICES.map((voice) => voice.locale.split('-')[0].toLowerCase())
    );
    return supportedLanguages.has(canonical.split('-')[0].toLowerCase()) ? canonical : null;
  } catch {
    return null;
  }
}

/** True only for a language supported by Judy Pierre's voice catalog. */
export function isSupportedSpokenLanguage(languageOrLocale: string | null | undefined): boolean {
  return normalizeVoiceLocale(languageOrLocale) !== null;
}

/** Display name accepted by the Hermes translation contract for a catalog locale. */
export function getTranslationLanguageName(languageOrLocale: string | null | undefined): string | null {
  const locale = normalizeVoiceLocale(languageOrLocale);
  if (!locale) return null;
  const language = baseLanguage(locale);
  return APPROVED_VOICES.find((voice) => baseLanguage(voice.locale) === language)?.language ?? null;
}

/** Whether two locale hints represent the same spoken language. */
export function languagesMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normalizedLeft = normalizeVoiceLocale(left);
  const normalizedRight = normalizeVoiceLocale(right);
  return Boolean(
    normalizedLeft && normalizedRight && baseLanguage(normalizedLeft) === baseLanguage(normalizedRight)
  );
}

/** Optional Hostinger variable name for an ElevenLabs voice chosen in settings. */
export function getElevenLabsVoiceEnvKey(voiceId: string): string {
  return `ELEVENLABS_VOICE_${voiceId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

/** Optional Hostinger variable name for a HeyGen voice chosen in settings. */
export function getHeyGenVoiceEnvKey(voiceId: string): string {
  return `HEYGEN_VOICE_${voiceId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function baseLanguage(locale: string): string {
  return locale.split('-')[0].toLowerCase();
}

export function isApprovedVoiceId(voiceId: string): boolean {
  return APPROVED_VOICE_IDS.includes(voiceId);
}

export function getVoiceOption(voiceId: string | null | undefined): VoiceOption | null {
  if (!voiceId) return null;
  return APPROVED_VOICES.find((v) => v.id === voiceId) ?? null;
}

/** True when a voice can naturally speak the requested language. */
export function isVoiceCompatibleWithLanguage(
  voice: VoiceOption,
  languageOrLocale: string | null | undefined
): boolean {
  const locale = normalizeVoiceLocale(languageOrLocale);
  if (!locale) return false;
  return baseLanguage(voice.locale) === baseLanguage(locale);
}

/**
 * Returns matching voices in deterministic order, with an exact dialect match
 * ahead of other voices for the same language.
 */
export function getVoicesForLanguage(
  languageOrLocale: string | null | undefined
): readonly VoiceOption[] {
  const locale = normalizeVoiceLocale(languageOrLocale);
  if (!locale) return [];

  const language = baseLanguage(locale);
  return APPROVED_VOICES.filter((voice) => baseLanguage(voice.locale) === language).sort(
    (left, right) => Number(right.locale === locale) - Number(left.locale === locale)
  );
}

/**
 * Selects the saved voice when it supports the spoken language, otherwise the
 * first locale-appropriate catalog voice. Missing or unsupported input falls
 * back to the original English voice so speech can always fail open safely.
 */
export function selectVoiceForLanguage(
  requestedVoiceId: string | null | undefined,
  languageOrLocale: string | null | undefined
): VoiceOption {
  const requestedVoice = getVoiceOption(requestedVoiceId);

  // Preserve the existing saved-voice behavior when no spoken language has
  // been selected yet. A non-empty but unrecognized language is not considered
  // compatible and intentionally falls back below.
  if (!languageOrLocale?.trim()) return requestedVoice ?? DEFAULT_VOICE;

  const locale = normalizeVoiceLocale(languageOrLocale);
  if (!locale) return DEFAULT_VOICE;

  if (requestedVoice && isVoiceCompatibleWithLanguage(requestedVoice, locale)) {
    return requestedVoice;
  }

  return getVoicesForLanguage(locale)[0] ?? DEFAULT_VOICE;
}
