/**
 * Sentence boundary detection for streaming display and sentence-level TTS.
 *
 * Used by the docked avatar to:
 * 1. Display only the *current* sentence in the subtitle caption
 * 2. Trigger sentence-level lipsync pre-fetch while streaming continues
 *
 * Intentionally simple — splits on `.` `!` `?` followed by whitespace or
 * end-of-string, but avoids splitting on common abbreviations, decimals,
 * and ellipsis.
 */

/**
 * Split text into sentences. Returns at least one element (the input itself)
 * even if no sentence boundary is found.
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];

  // Protect common abbreviations and decimals from being treated as sentence
  // ends. We replace them with placeholders, split, then restore.
  const ABBREVIATIONS = [
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Jr.', 'Sr.', 'Prof.', 'St.',
    'Ave.', 'Blvd.', 'Dept.', 'Fig.', 'vs.', 'etc.', 'Inc.', 'Ltd.',
    'i.e.', 'e.g.', 'approx.', 'est.', 'min.', 'max.', 'no.',
  ];

  let protected_ = text;
  const restoreMap: [string, string][] = [];

  for (const abbr of ABBREVIATIONS) {
    const placeholder = `__ABBR_${restoreMap.length}__`;
    // Case-insensitive replacement
    const escaped = abbr.replace(/\./g, '\\.');
    const re = new RegExp(escaped, 'gi');
    if (re.test(protected_)) {
      protected_ = protected_.replace(re, placeholder);
      restoreMap.push([placeholder, abbr]);
    }
  }

  // Protect decimal numbers (e.g. $12.50, 3.14)
  protected_ = protected_.replace(/(\d)\.(\d)/g, '$1__DEC__$2');

  // Protect ellipsis
  protected_ = protected_.replace(/\.{2,}/g, (match) => '__ELLIPSIS_' + match.length + '__');

  // Split on sentence-ending punctuation followed by whitespace or end
  const raw = protected_.split(/(?<=[.!?])\s+/);

  // Restore protected tokens
  return raw
    .map((segment) => {
      let restored = segment;
      for (const [placeholder, original] of restoreMap) {
        restored = restored.replaceAll(placeholder, original);
      }
      restored = restored.replace(/__DEC__/g, '.');
      restored = restored.replace(/__ELLIPSIS_(\d+)__/g, (_match, len) =>
        '.'.repeat(Number(len))
      );
      return restored.trim();
    })
    .filter((s) => s.length > 0);
}

/**
 * Given a list of sentences and an elapsed time in seconds, return the
 * index of the sentence that should be displayed as the current caption.
 *
 * Uses a simple heuristic: ~50ms per character (~20 chars/sec speaking pace).
 * This is only used as a *caption display* estimate — accurate lip sync
 * timing is driven by Rhubarb cues, not this function.
 */
export function currentSentenceIndex(
  sentences: string[],
  elapsedSeconds: number
): number {
  if (sentences.length === 0) return -1;

  const CHARS_PER_SECOND = 18;
  let cumulativeTime = 0;

  for (let i = 0; i < sentences.length; i++) {
    const duration = sentences[i].length / CHARS_PER_SECOND;
    cumulativeTime += duration;
    if (elapsedSeconds < cumulativeTime) return i;
  }

  return sentences.length - 1;
}

/**
 * Extract completed sentences from a partially-streamed text.
 * Returns { complete: string[], partial: string }.
 * `complete` contains sentences that have a terminator;
 * `partial` is the trailing fragment that hasn't ended yet.
 */
export function extractCompleteSentences(text: string): {
  complete: string[];
  partial: string;
} {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { complete: [], partial: '' };

  // If the original text ends with sentence-ending punctuation (after
  // trimming), every sentence is complete.
  if (/[.!?]\s*$/.test(text)) {
    return { complete: sentences, partial: '' };
  }

  // Otherwise the last segment is still being streamed.
  return {
    complete: sentences.slice(0, -1),
    partial: sentences[sentences.length - 1],
  };
}
