import { describe, expect, it } from 'vitest';
import { getAvatarFacingRotation, sampleAvatarMotion } from '../motion';

describe('sampleAvatarMotion', () => {
  it('is deterministic and keeps every phase restrained', () => {
    const phases = ['idle', 'welcoming', 'listening', 'editing', 'thinking', 'speaking', 'paused', 'error'] as const;

    for (const phase of phases) {
      const first = sampleAvatarMotion(phase, 3.25, false);
      const second = sampleAvatarMotion(phase, 3.25, false);
      expect(first).toEqual(second);
      expect(Math.abs(first.rootY)).toBeLessThanOrEqual(0.02);
      expect(first.rootScale).toBeGreaterThanOrEqual(0.99);
      expect(first.rootScale).toBeLessThanOrEqual(1.02);
      expect(Math.abs(first.headPitch)).toBeLessThanOrEqual(0.12);
      expect(Math.abs(first.headYaw)).toBeLessThanOrEqual(0.12);
      expect(Math.abs(first.headRoll)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(first.earRoll)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(first.chestPitch)).toBeLessThanOrEqual(0.06);
    }
  });

  it('gives listening, thinking, and speaking distinct attentive poses', () => {
    const listening = sampleAvatarMotion('listening', 1.75, false);
    const thinking = sampleAvatarMotion('thinking', 1.75, false);
    const speaking = sampleAvatarMotion('speaking', 1.75, false);

    expect(listening.headPitch).toBeLessThan(0);
    expect(Math.abs(listening.earRoll)).toBeGreaterThan(0);
    expect(Math.abs(thinking.headRoll)).toBeGreaterThan(Math.abs(listening.headRoll));
    expect(Math.abs(speaking.chestPitch)).toBeGreaterThan(Math.abs(listening.chestPitch));
  });

  it('turns off every non-mouth movement when reduced motion is requested', () => {
    expect(sampleAvatarMotion('speaking', 10, true)).toEqual({
      rootY: 0,
      rootScale: 1,
      headPitch: 0,
      headYaw: 0,
      headRoll: 0,
      earRoll: 0,
      chestPitch: 0,
    });
  });

  it('front-faces only the bundled Judy model and preserves uploaded orientations', () => {
    expect(getAvatarFacingRotation('/models/judyface.glb')).toBe(-Math.PI / 2);
    expect(getAvatarFacingRotation('/api/avatar/model?v=uploaded')).toBe(0);
  });
});
