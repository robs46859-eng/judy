/**
 * Keyword-based emotion detection from Judy's reply text.
 *
 * Returns a set of morph-target weight presets the avatar can blend toward
 * over ~0.5 s to convey conversational emotion. The weights are intentionally
 * subtle — a hint of expression, not a cartoon face. All values are in the
 * [0, 1] range and additive to whatever the current lip-sync / idle motion
 * is doing (the caller clamps to 1).
 *
 * This is NOT sentiment analysis — it looks for concrete Judy-domain
 * phrases so it stays deterministic and testable.
 */

export interface EmotionPreset {
  /** Human-readable label (useful for debug overlays). */
  name: string;
  /** Morph-target weights to blend toward. Absent keys → 0. */
  morphWeights: Partial<Record<string, number>>;
  /** Additive head-pitch offset (negative = nod forward). */
  headPitchOffset: number;
  /** Additive ear-roll offset (positive = ears up). */
  earRollOffset: number;
}

const EMOTIONS: { patterns: RegExp; preset: EmotionPreset }[] = [
  // ── Excited / enthusiastic ────────────────────────────
  {
    patterns:
      /\b(amazing|incredible|fabulous|must[- ]see|must[- ]visit|absolutely|stunning|gorgeous|wow|love it|you'll love|can't miss|spectacular)\b/i,
    preset: {
      name: 'excited',
      morphWeights: {
        mouthSmile_L: 0.25,
        mouthSmile_R: 0.25,
        browInnerUp: 0.12,
        cheekSquint_L: 0.08,
        cheekSquint_R: 0.08,
      },
      headPitchOffset: -0.015,
      earRollOffset: 0.02,
    },
  },
  // ── Concerned / safety ────────────────────────────────
  {
    patterns:
      /\b(careful|caution|safe(ty|r)?|warning|danger|avoid|risky|watch out|be aware|heads[- ]up|alert|scam)\b/i,
    preset: {
      name: 'concerned',
      morphWeights: {
        browDown_L: 0.15,
        browDown_R: 0.15,
        mouthFrown_L: 0.1,
        mouthFrown_R: 0.1,
      },
      headPitchOffset: 0.01,
      earRollOffset: -0.015,
    },
  },
  // ── Warm / affectionate ───────────────────────────────
  {
    patterns:
      /\b(darling|sweetheart|friend|love|proud|welcome|glad|happy|wonderful|beautiful)\b/i,
    preset: {
      name: 'warm',
      morphWeights: {
        mouthSmile_L: 0.15,
        mouthSmile_R: 0.15,
        cheekSquint_L: 0.05,
        cheekSquint_R: 0.05,
      },
      headPitchOffset: -0.008,
      earRollOffset: 0.01,
    },
  },
  // ── Thinking / uncertain ──────────────────────────────
  {
    patterns:
      /\b(hmm|well|let me think|not sure|it depends|maybe|possibly|i'd say|on one hand)\b/i,
    preset: {
      name: 'thinking',
      morphWeights: {
        browInnerUp: 0.1,
        mouthPucker: 0.08,
      },
      headPitchOffset: -0.005,
      earRollOffset: 0,
    },
  },
];

/** Neutral fallback — no expression offset. */
const NEUTRAL: EmotionPreset = {
  name: 'neutral',
  morphWeights: {},
  headPitchOffset: 0,
  earRollOffset: 0,
};

/**
 * Scan the reply text and return the first matching emotion preset.
 * Falls back to neutral if nothing matches.
 */
export function detectEmotion(text: string): EmotionPreset {
  for (const entry of EMOTIONS) {
    if (entry.patterns.test(text)) return entry.preset;
  }
  return NEUTRAL;
}
