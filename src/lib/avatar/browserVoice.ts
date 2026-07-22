export interface BrowserVoiceLike {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
}

const NATURAL_VOICE = /\b(natural|neural|premium|enhanced|studio|online)\b/i;
const PREFERRED_ENGLISH_VOICE = /\b(samantha|ava|allison|serena|daniel|google us english|microsoft aria|microsoft jenny)\b/i;

/**
 * Pick the best installed browser fallback without assuming a voice exists on
 * every OS. ElevenLabs remains primary; this only runs when server TTS fails.
 */
export function selectBrowserVoice<T extends BrowserVoiceLike>(
  voices: readonly T[],
  languageOrLocale?: string | null
): T | null {
  if (voices.length === 0) return null;
  const requested = languageOrLocale?.trim().toLowerCase() ?? '';
  const base = requested.split('-')[0];

  const scored = voices.map((voice, index) => {
    const locale = voice.lang.toLowerCase();
    let score = 0;
    if (requested && locale === requested) score += 100;
    else if (base && locale.split('-')[0] === base) score += 60;
    if (NATURAL_VOICE.test(voice.name)) score += 20;
    if (base === 'en' && PREFERRED_ENGLISH_VOICE.test(voice.name)) score += 12;
    if (voice.localService) score += 3;
    if (voice.default) score += 1;
    return { voice, score, index };
  });

  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  return scored[0]?.voice ?? null;
}
