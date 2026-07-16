/**
 * Defensively extract a human-readable string from a Hermes job result.
 *
 * The Gemma/Hermes worker owns its own result shape, which we can't import
 * here. Rather than hard-code one field, we accept a plain string or probe a
 * set of common keys (and one level of nesting) so translation and knowledge
 * results both resolve without coupling the UI to the worker's exact schema.
 * Returns null when nothing usable is found, so callers can fall back.
 */

const TEXT_KEYS = [
  'translation',
  'translated_text',
  'translatedText',
  'text',
  'answer',
  'output',
  'response',
  'reply',
  'content',
  'result',
  'message',
] as const;

export function extractHermesText(result: unknown, depth = 0): string | null {
  if (result == null || depth > 4) return null;

  if (typeof result === 'string') {
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof result !== 'object') return null;

  // Arrays: return the first extractable entry.
  if (Array.isArray(result)) {
    for (const item of result) {
      const found = extractHermesText(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const obj = result as Record<string, unknown>;
  for (const key of TEXT_KEYS) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (value && typeof value === 'object') {
      const nested = extractHermesText(value, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
}
