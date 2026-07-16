import { describe, it, expect } from 'vitest';
import { selectTrip, type TripLike } from '../selectTrip';

const NOW = new Date('2026-07-16T12:00:00.000Z').getTime();

function trip(overrides: Partial<TripLike> & { id: string }): TripLike {
  return {
    departureDate: '2026-01-01T00:00:00.000Z',
    returnDate: '2026-01-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectTrip', () => {
  it('returns null for an empty or missing list', () => {
    expect(selectTrip([], NOW)).toBeNull();
    expect(selectTrip(null, NOW)).toBeNull();
    expect(selectTrip(undefined, NOW)).toBeNull();
  });

  it('does not blindly pick the first item from an ascending response', () => {
    // API returns trips ascending by departureDate — the first item here is
    // a trip that already finished months ago, not the one to show.
    const longPast = trip({
      id: 'long-past',
      departureDate: '2026-01-01T00:00:00.000Z',
      returnDate: '2026-01-05T00:00:00.000Z',
    });
    const soonUpcoming = trip({
      id: 'soon-upcoming',
      departureDate: '2026-07-20T00:00:00.000Z',
      returnDate: '2026-07-27T00:00:00.000Z',
    });
    const farUpcoming = trip({
      id: 'far-upcoming',
      departureDate: '2026-12-01T00:00:00.000Z',
      returnDate: '2026-12-10T00:00:00.000Z',
    });

    const result = selectTrip([longPast, soonUpcoming, farUpcoming], NOW);
    expect(result?.id).toBe('soon-upcoming');
  });

  it('prefers a trip that is active right now over a nearer-looking upcoming one', () => {
    const active = trip({
      id: 'active-now',
      departureDate: '2026-07-14T00:00:00.000Z',
      returnDate: '2026-07-18T00:00:00.000Z',
    });
    const upcoming = trip({
      id: 'upcoming-soon',
      departureDate: '2026-07-17T00:00:00.000Z',
      returnDate: '2026-07-19T00:00:00.000Z',
    });

    const result = selectTrip([upcoming, active], NOW);
    expect(result?.id).toBe('active-now');
  });

  it('falls back to the most recently updated past trip when none are active/upcoming', () => {
    const olderPast = trip({
      id: 'older-past',
      departureDate: '2026-05-01T00:00:00.000Z',
      returnDate: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-06T00:00:00.000Z',
    });
    const recentlyEditedPast = trip({
      id: 'recently-edited-past',
      departureDate: '2026-03-01T00:00:00.000Z',
      returnDate: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    });

    const result = selectTrip([olderPast, recentlyEditedPast], NOW);
    expect(result?.id).toBe('recently-edited-past');
  });

  it('ignores trips with unparsable dates instead of crashing', () => {
    const broken = trip({ id: 'broken', departureDate: 'not-a-date', returnDate: 'also-not-a-date' });
    const upcoming = trip({
      id: 'valid-upcoming',
      departureDate: '2026-08-01T00:00:00.000Z',
      returnDate: '2026-08-05T00:00:00.000Z',
    });

    const result = selectTrip([broken, upcoming], NOW);
    expect(result?.id).toBe('valid-upcoming');
  });
});
