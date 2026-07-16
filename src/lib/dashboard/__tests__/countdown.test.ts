import { describe, it, expect } from 'vitest';
import { computeCountdown } from '../countdown';

describe('computeCountdown', () => {
  it('returns null when there is no departure date', () => {
    expect(computeCountdown(null)).toBeNull();
    expect(computeCountdown(undefined)).toBeNull();
  });

  it('returns null for an unparsable date instead of NaN values', () => {
    expect(computeCountdown('not-a-date')).toBeNull();
  });

  it('computes days/hours/mins for a future departure — synchronously, no timer required', () => {
    const now = new Date('2026-07-16T00:00:00.000Z').getTime();
    const departure = new Date('2026-07-19T06:30:00.000Z').toISOString();

    // Calling this directly (no setInterval/setTimeout involved) is what lets
    // the caller seed state immediately instead of waiting a full second.
    const result = computeCountdown(departure, now);

    expect(result).toEqual({ days: 3, hours: 6, mins: 30 });
  });

  it('returns a zeroed countdown once departure has passed', () => {
    const now = new Date('2026-07-16T12:00:00.000Z').getTime();
    const departure = new Date('2026-07-10T00:00:00.000Z').toISOString();

    expect(computeCountdown(departure, now)).toEqual({ days: 0, hours: 0, mins: 0 });
  });

  it('returns a zeroed countdown exactly at departure', () => {
    const now = new Date('2026-07-16T12:00:00.000Z').getTime();
    expect(computeCountdown(new Date(now).toISOString(), now)).toEqual({ days: 0, hours: 0, mins: 0 });
  });
});
