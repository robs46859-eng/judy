/**
 * Viseme timeline (Swarm J7) — pure, provider-agnostic logic for driving a
 * rigged GLB avatar's mouth from a Rhubarb Lip Sync cue list.
 *
 * Rhubarb (https://github.com/DanielSWolf/rhubarb-lip-sync) analyzes a WAV
 * file and emits JSON shaped like:
 *   { metadata: { duration: 1.23 }, mouthCues: [{ start, end, value }, ...] }
 * where `value` is one of the 9 standard Preston Blair-derived mouth shapes:
 * A, B, C, D, E, F, G, H, X (X = closed/idle). Nothing in this file talks to
 * the Rhubarb binary, a TTS provider, or the DOM — it only turns a cue list
 * plus a playback time into a set of morph-target weights, so it can be unit
 * tested without audio, a GLB, or a browser.
 */

export const RHUBARB_SHAPES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'] as const;
export type RhubarbShape = (typeof RHUBARB_SHAPES)[number];

export interface RhubarbCue {
  start: number;
  end: number;
  value: RhubarbShape;
}

export interface RhubarbResult {
  metadata?: { duration?: number; [key: string]: unknown };
  mouthCues: RhubarbCue[];
}

/** Weight (0-1) for each of the 9 Rhubarb mouth shapes at a point in time. */
export type VisemeWeights = Record<RhubarbShape, number>;

function isRhubarbShape(value: unknown): value is RhubarbShape {
  return typeof value === 'string' && (RHUBARB_SHAPES as readonly string[]).includes(value);
}

function zeroWeights(): VisemeWeights {
  return { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, X: 1 };
}

/**
 * Parse and validate raw Rhubarb JSON output (as returned by `rhubarb -f
 * json`, or forwarded over the network from a server endpoint that ran it).
 * Malformed/missing cues are dropped rather than throwing — a partially
 * broken timeline should degrade to "mouth closed" for the bad segments, not
 * crash the caller. Cues are sorted by start time and clamped so
 * `end >= start`.
 */
export function parseRhubarbResult(json: unknown): RhubarbCue[] {
  if (!json || typeof json !== 'object') return [];
  const raw = (json as { mouthCues?: unknown }).mouthCues;
  if (!Array.isArray(raw)) return [];

  const cues: RhubarbCue[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { start, end, value } = entry as Record<string, unknown>;
    if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) continue;
    if (typeof end !== 'number' || !Number.isFinite(end)) continue;
    if (!isRhubarbShape(value)) continue;
    cues.push({ start, end: Math.max(end, start), value });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/**
 * The cue active at `timeSeconds`, or null before the first cue / after the
 * last one (silence — mouth should be closed).
 */
export function getActiveCue(cues: RhubarbCue[], timeSeconds: number): RhubarbCue | null {
  if (cues.length === 0) return null;
  // Cues are contiguous in well-formed Rhubarb output, so a linear scan is
  // fine — timelines are seconds long, never thousands of cues.
  for (const cue of cues) {
    if (timeSeconds >= cue.start && timeSeconds < cue.end) return cue;
  }
  return null;
}

/**
 * Blend-shape weights at `timeSeconds`. Instantly snapping between mouth
 * shapes looks like a slideshow, so this linearly crossfades from the
 * previous cue's shape into the active one over `blendSeconds` at the start
 * of each cue. Falls back to fully-closed ("X" = 1) when there's no active
 * cue (before speech starts, after it ends, or an empty timeline).
 */
export function getVisemeWeights(
  cues: RhubarbCue[],
  timeSeconds: number,
  options?: { blendSeconds?: number }
): VisemeWeights {
  const blendSeconds = options?.blendSeconds ?? 0.05;
  const weights = zeroWeights();
  weights.X = 0;

  const activeIndex = cues.findIndex((c) => timeSeconds >= c.start && timeSeconds < c.end);
  if (activeIndex === -1) {
    weights.X = 1;
    return weights;
  }

  const active = cues[activeIndex];
  const timeIntoCue = timeSeconds - active.start;

  if (blendSeconds <= 0 || timeIntoCue >= blendSeconds || activeIndex === 0) {
    weights[active.value] = 1;
    return weights;
  }

  // Crossfade from the previous cue's shape into this one.
  const previous = cues[activeIndex - 1];
  const t = timeIntoCue / blendSeconds; // 0 (just started) → 1 (fully blended in)
  if (previous.value === active.value) {
    weights[active.value] = 1;
    return weights;
  }
  weights[previous.value] = 1 - t;
  weights[active.value] = t;
  return weights;
}

/**
 * Preferred morph target names on the rigged GLB — one per Rhubarb shape.
 * If the model doesn't have these (no dedicated viseme_* blend shapes),
 * `ARKIT_VISEME_APPROXIMATION` below maps each shape onto a combination of
 * common ARKit-style shape keys instead.
 */
export function visemeMorphTargetName(shape: RhubarbShape): string {
  return `viseme_${shape}`;
}

/**
 * Fallback mapping onto ARKit-style blend shapes for GLBs that don't expose
 * dedicated `viseme_*` targets. Each Rhubarb shape maps to one or more ARKit
 * targets with a weight multiplier (applied on top of the shape's own
 * weight from `getVisemeWeights`). This is an approximation, not a 1:1
 * mapping — Rhubarb's 9 shapes are coarser than the full ARKit set.
 */
export const ARKIT_VISEME_APPROXIMATION: Record<RhubarbShape, Record<string, number>> = {
  // Closed / rest.
  X: { mouthClose: 1 },
  // "AI" — wide open jaw (ah, ay).
  A: { jawOpen: 1 },
  // "E" — slightly open, relaxed (eh).
  B: { jawOpen: 0.35, mouthClose: 0.25 },
  // "E" wide — teeth together, corners stretched (ee).
  C: { jawOpen: 0.2, mouthSmileLeft: 0.6, mouthSmileRight: 0.6 },
  // "U/O" rounded — pucker (oh, oo).
  D: { jawOpen: 0.5, mouthFunnel: 0.7 },
  E: { jawOpen: 0.3, mouthPucker: 0.8 },
  // "F/V" — lower lip to upper teeth.
  F: { jawOpen: 0.15, mouthPressLeft: 0.4, mouthPressRight: 0.4 },
  // "L" — tongue behind teeth, jaw slightly open.
  G: { jawOpen: 0.3 },
  // "W/Q" — tight pucker.
  H: { jawOpen: 0.1, mouthPucker: 1 },
};

/**
 * Stage-1, no-cost approximation used when there's no Rhubarb timeline at
 * all (e.g. the browser's own speechSynthesis, which exposes no audio
 * stream or timing to analyze). Produces a smooth, bounded jaw-open value
 * that oscillates while `talking` is true and eases back to closed
 * otherwise — "talking" motion, not real lip sync.
 */
export function approximateTalkingJawWeight(timeSeconds: number, talking: boolean): number {
  if (!talking) return 0;
  // Two overlapping sine waves at different rates reads as more organic
  // "mouth moving" than a single steady oscillation.
  const primary = Math.sin(timeSeconds * 9) * 0.5 + 0.5;
  const secondary = Math.sin(timeSeconds * 13.7 + 1) * 0.5 + 0.5;
  const blended = primary * 0.65 + secondary * 0.35;
  // Keep it in a believable range — never fully closed (dead) or fully
  // agape (uncanny) while actively "talking".
  return 0.15 + blended * 0.55;
}
