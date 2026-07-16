/**
 * Deterministic translation-intent detection for the Travel Daddy chat route
 * (Swarm J4). Two triggers, both rule-based — never LLM-inferred:
 *
 *  1. Explicit intent: the user directly asks for a translation
 *     ("translate X to Y", "how do you say X in Y", ...).
 *  2. Script mismatch: the message is written in a non-Latin script that
 *     doesn't match the user's stored native language — a cheap, fully
 *     deterministic Unicode-range heuristic, NOT general language
 *     identification. Latin-script languages (Spanish vs. French vs.
 *     Portuguese, etc.) are intentionally NOT guessed at here — that needs
 *     a real language-ID library, which this slice does not add.
 */

export interface TranslationIntent {
  textToTranslate: string;
  targetLanguage: string;
  sourceLanguage?: string;
  reason: 'explicit' | 'script-mismatch';
}

const EXPLICIT_PATTERNS: RegExp[] = [
  /^(?:please\s+)?translate\s+(.+?)\s+(?:in\s*)?to\s+([a-zÀ-ɏ\s]+?)[.!?]*$/i,
  /^how\s+do\s+(?:you|i)\s+say\s+(.+?)\s+in\s+([a-zÀ-ɏ\s]+?)[.!?]*$/i,
  /^what(?:'s| is)\s+(.+?)\s+in\s+([a-zÀ-ɏ\s]+?)[.!?]*$/i,
];

/** Matches an explicit "translate/how do you say X in Y" request. */
export function detectExplicitTranslationIntent(message: string): TranslationIntent | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  for (const pattern of EXPLICIT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const [, text, lang] = match;
    const textToTranslate = text?.trim();
    const targetLanguage = lang?.trim();
    if (textToTranslate && targetLanguage) {
      return { textToTranslate, targetLanguage, reason: 'explicit' };
    }
  }
  return null;
}

// \u{HEX} escapes rather than literal characters — unambiguous and easy to
// verify against the Unicode block chart regardless of editor/encoding.
// Each range below targets a whole Unicode block (documented in the comment)
// so exact edge characters don't matter for correctness — real-world text in
// these scripts sits comfortably in the middle of the block, never at the
// boundary code points.
const SCRIPT_PATTERNS: ReadonlyArray<{ language: string; pattern: RegExp }> = [
  { language: 'Chinese', pattern: /[一-鿿]/ }, // CJK Unified Ideographs (~U+4E00-U+9FFF)
  { language: 'Japanese', pattern: /[぀-ヿ]/ }, // Hiragana + Katakana (~U+3040-U+30FF)
  { language: 'Korean', pattern: /[가-힣]/ }, // Hangul syllables (~U+AC00-U+D7A3)
  { language: 'Arabic', pattern: /[؀-ۿ]/ }, // Arabic (~U+0600-U+06FF)
  { language: 'Russian', pattern: /[Ѐ-ӿ]/ }, // Cyrillic (~U+0400-U+04FF)
  { language: 'Greek', pattern: /[Ͱ-Ͽ]/ }, // Greek and Coptic (~U+0370-U+03FF)
  { language: 'Thai', pattern: /[฀-๿]/ }, // Thai (~U+0E00-U+0E7F)
  { language: 'Hebrew', pattern: /[֐-׿]/ }, // Hebrew (~U+0590-U+05FF)
];

/** Best-effort, Unicode-range-only script detection — not full language ID. */
export function detectScriptLanguage(message: string): string | null {
  for (const { language, pattern } of SCRIPT_PATTERNS) {
    if (pattern.test(message)) return language;
  }
  return null;
}

/**
 * If the message is written in a script that doesn't match the user's
 * stored native language, offer to translate it into that native language.
 * Returns null whenever there's nothing to reconcile — no native language on
 * file, message already looks like it matches, or no distinctive script.
 */
export function detectScriptMismatch(
  message: string,
  nativeLanguage: string | null | undefined
): TranslationIntent | null {
  const trimmed = message.trim();
  if (!trimmed || !nativeLanguage) return null;

  const detected = detectScriptLanguage(trimmed);
  if (!detected) return null;
  if (detected.toLowerCase() === nativeLanguage.trim().toLowerCase()) return null;

  return {
    textToTranslate: trimmed,
    targetLanguage: nativeLanguage.trim(),
    sourceLanguage: detected,
    reason: 'script-mismatch',
  };
}

/** Runs both detectors, explicit intent taking priority. */
export function detectTranslationIntent(
  message: string,
  nativeLanguage: string | null | undefined
): TranslationIntent | null {
  return (
    detectExplicitTranslationIntent(message) ?? detectScriptMismatch(message, nativeLanguage)
  );
}
