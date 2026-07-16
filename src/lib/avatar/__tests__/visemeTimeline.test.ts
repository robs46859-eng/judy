import { describe, it, expect } from 'vitest';
import {
  RHUBARB_SHAPES,
  parseRhubarbResult,
  getActiveCue,
  getVisemeWeights,
  visemeMorphTargetName,
  ARKIT_VISEME_APPROXIMATION,
  approximateTalkingJawWeight,
  type RhubarbCue,
} from '../visemeTimeline';

function cue(start: number, end: number, value: RhubarbCue['value']): RhubarbCue {
  return { start, end, value };
}

describe('parseRhubarbResult', () => {
  it('parses a well-formed Rhubarb JSON payload', () => {
    const cues = parseRhubarbResult({
      metadata: { duration: 1.2 },
      mouthCues: [
        { start: 0, end: 0.1, value: 'X' },
        { start: 0.1, end: 0.3, value: 'A' },
      ],
    });
    expect(cues).toEqual([cue(0, 0.1, 'X'), cue(0.1, 0.3, 'A')]);
  });

  it('returns an empty list for non-object input', () => {
    expect(parseRhubarbResult(null)).toEqual([]);
    expect(parseRhubarbResult(undefined)).toEqual([]);
    expect(parseRhubarbResult('not json')).toEqual([]);
    expect(parseRhubarbResult(42)).toEqual([]);
  });

  it('returns an empty list when mouthCues is missing or not an array', () => {
    expect(parseRhubarbResult({})).toEqual([]);
    expect(parseRhubarbResult({ mouthCues: 'nope' })).toEqual([]);
  });

  it('drops individual malformed cues instead of throwing', () => {
    const cues = parseRhubarbResult({
      mouthCues: [
        { start: 0, end: 0.1, value: 'X' }, // valid
        { start: -1, end: 0.2, value: 'A' }, // negative start
        { start: 0.2, end: 0.3, value: 'Q' }, // not a real shape
        { start: 'x', end: 0.3, value: 'B' }, // wrong type
        { end: 0.3, value: 'C' }, // missing start
        null,
        'garbage',
      ],
    });
    expect(cues).toEqual([cue(0, 0.1, 'X')]);
  });

  it('clamps end to start when end < start', () => {
    const cues = parseRhubarbResult({ mouthCues: [{ start: 1, end: 0.5, value: 'A' }] });
    expect(cues).toEqual([cue(1, 1, 'A')]);
  });

  it('sorts cues by start time regardless of input order', () => {
    const cues = parseRhubarbResult({
      mouthCues: [
        { start: 0.5, end: 0.6, value: 'B' },
        { start: 0, end: 0.1, value: 'X' },
        { start: 0.2, end: 0.3, value: 'A' },
      ],
    });
    expect(cues.map((c) => c.start)).toEqual([0, 0.2, 0.5]);
  });

  it('accepts every standard Rhubarb shape', () => {
    const cues = parseRhubarbResult({
      mouthCues: RHUBARB_SHAPES.map((value, i) => ({ start: i, end: i + 1, value })),
    });
    expect(cues.map((c) => c.value)).toEqual([...RHUBARB_SHAPES]);
  });
});

describe('getActiveCue', () => {
  const cues = [cue(0, 0.2, 'X'), cue(0.2, 0.5, 'A'), cue(0.5, 0.8, 'B')];

  it('returns the cue containing the given time', () => {
    expect(getActiveCue(cues, 0.3)).toEqual(cue(0.2, 0.5, 'A'));
  });

  it('treats cue boundaries as [start, end)', () => {
    expect(getActiveCue(cues, 0.2)?.value).toBe('A');
    expect(getActiveCue(cues, 0.5)?.value).toBe('B');
  });

  it('returns null before the first cue and after the last', () => {
    expect(getActiveCue(cues, -1)).toBeNull();
    expect(getActiveCue(cues, 10)).toBeNull();
  });

  it('returns null for an empty timeline', () => {
    expect(getActiveCue([], 0)).toBeNull();
  });
});

describe('getVisemeWeights', () => {
  it('is fully closed (X=1) when there is no active cue', () => {
    const weights = getVisemeWeights([], 0);
    expect(weights.X).toBe(1);
    expect(weights.A).toBe(0);
  });

  it('is fully closed before speech starts and after it ends', () => {
    const cues = [cue(0.5, 1, 'A')];
    expect(getVisemeWeights(cues, 0).X).toBe(1);
    expect(getVisemeWeights(cues, 2).X).toBe(1);
  });

  it('is fully in the active shape once past the blend window', () => {
    const cues = [cue(0, 0.3, 'X'), cue(0.3, 0.6, 'A')];
    const weights = getVisemeWeights(cues, 0.3 + 0.1, { blendSeconds: 0.05 });
    expect(weights.A).toBe(1);
    expect(weights.X).toBe(0);
  });

  it('crossfades from the previous shape at the start of a new cue', () => {
    const cues = [cue(0, 0.3, 'X'), cue(0.3, 0.6, 'A')];
    const weights = getVisemeWeights(cues, 0.3 + 0.025, { blendSeconds: 0.05 });
    expect(weights.X).toBeCloseTo(0.5, 5);
    expect(weights.A).toBeCloseTo(0.5, 5);
  });

  it('does not blend at the very first cue (nothing to blend from)', () => {
    const cues = [cue(0, 0.3, 'A')];
    const weights = getVisemeWeights(cues, 0, { blendSeconds: 0.05 });
    expect(weights.A).toBe(1);
  });

  it('snaps instantly when blendSeconds is 0', () => {
    const cues = [cue(0, 0.3, 'X'), cue(0.3, 0.6, 'A')];
    const weights = getVisemeWeights(cues, 0.3, { blendSeconds: 0 });
    expect(weights.A).toBe(1);
    expect(weights.X).toBe(0);
  });

  it('does not blend between two cues of the same shape', () => {
    const cues = [cue(0, 0.3, 'A'), cue(0.3, 0.6, 'A')];
    const weights = getVisemeWeights(cues, 0.31, { blendSeconds: 0.05 });
    expect(weights.A).toBe(1);
  });

  it('every weight stays within [0, 1]', () => {
    const cues = [cue(0, 0.3, 'B'), cue(0.3, 0.6, 'D')];
    for (const t of [0, 0.1, 0.29, 0.3, 0.32, 0.4, 0.6]) {
      const weights = getVisemeWeights(cues, t);
      for (const shape of RHUBARB_SHAPES) {
        expect(weights[shape]).toBeGreaterThanOrEqual(0);
        expect(weights[shape]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('visemeMorphTargetName', () => {
  it('prefixes every shape with viseme_', () => {
    for (const shape of RHUBARB_SHAPES) {
      expect(visemeMorphTargetName(shape)).toBe(`viseme_${shape}`);
    }
  });
});

describe('ARKIT_VISEME_APPROXIMATION', () => {
  it('has an entry for every Rhubarb shape', () => {
    for (const shape of RHUBARB_SHAPES) {
      expect(ARKIT_VISEME_APPROXIMATION[shape]).toBeDefined();
      expect(Object.keys(ARKIT_VISEME_APPROXIMATION[shape]).length).toBeGreaterThan(0);
    }
  });

  it('every weight multiplier is within [0, 1]', () => {
    for (const shape of RHUBARB_SHAPES) {
      for (const weight of Object.values(ARKIT_VISEME_APPROXIMATION[shape])) {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('approximateTalkingJawWeight (stage 1, no-cost fallback)', () => {
  it('is always 0 when not talking', () => {
    for (const t of [0, 0.5, 1, 3.33]) {
      expect(approximateTalkingJawWeight(t, false)).toBe(0);
    }
  });

  it('stays within a believable, non-zero range while talking', () => {
    for (let t = 0; t < 5; t += 0.13) {
      const w = approximateTalkingJawWeight(t, true);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it('varies over time rather than staying constant (it should look like motion)', () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => approximateTalkingJawWeight(t, true));
    const distinct = new Set(samples.map((v) => v.toFixed(6)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('is deterministic for a given time', () => {
    expect(approximateTalkingJawWeight(1.23, true)).toBe(approximateTalkingJawWeight(1.23, true));
  });
});
