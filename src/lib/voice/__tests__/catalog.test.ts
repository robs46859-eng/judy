import { describe, it, expect } from 'vitest';
import {
  APPROVED_VOICES,
  APPROVED_VOICE_IDS,
  isApprovedVoiceId,
  getVoiceOption,
} from '../catalog';

describe('voice catalog (Swarm J5)', () => {
  it('exposes at least one approved voice, each with a non-empty id and label', () => {
    expect(APPROVED_VOICES.length).toBeGreaterThan(0);
    for (const voice of APPROVED_VOICES) {
      expect(voice.id.length).toBeGreaterThan(0);
      expect(voice.label.length).toBeGreaterThan(0);
      expect(voice.language.length).toBeGreaterThan(0);
    }
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
});
