/**
 * Trip selection for the dashboard home screen.
 *
 * `GET /api/trips` returns trips ordered ascending by `departureDate` — that
 * is NOT the same as "the trip the user cares about right now." Blindly
 * taking the first item picks whichever trip happens to have the earliest
 * departure date in the whole result set, which is frequently a trip that
 * already happened.
 *
 * Priority used here instead:
 *   1. A trip that is active right now (departure <= now <= return), or the
 *      nearest upcoming trip (soonest departure in the future).
 *   2. If none are active/upcoming, the most recently updated past trip.
 *   3. Otherwise, no trip to show.
 */

export interface TripLike {
  id: string;
  departureDate: string | Date;
  returnDate: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

interface TimedTrip<T extends TripLike> {
  trip: T;
  departure: number;
  ret: number;
}

function toTimedTrips<T extends TripLike>(trips: T[]): TimedTrip<T>[] {
  return trips
    .map((trip) => ({
      trip,
      departure: new Date(trip.departureDate).getTime(),
      ret: new Date(trip.returnDate).getTime(),
    }))
    .filter((t) => Number.isFinite(t.departure) && Number.isFinite(t.ret));
}

export function selectTrip<T extends TripLike>(
  trips: T[] | null | undefined,
  now: number = Date.now()
): T | null {
  if (!trips || trips.length === 0) return null;

  const timed = toTimedTrips(trips);
  if (timed.length === 0) return trips[0] ?? null;

  const active = timed.filter((t) => t.departure <= now && t.ret >= now);
  if (active.length > 0) {
    active.sort((a, b) => a.ret - b.ret);
    return active[0].trip;
  }

  const upcoming = timed.filter((t) => t.departure > now);
  if (upcoming.length > 0) {
    upcoming.sort((a, b) => a.departure - b.departure);
    return upcoming[0].trip;
  }

  const past = timed.filter((t) => t.ret < now);
  if (past.length > 0) {
    past.sort((a, b) => {
      const bu = b.trip.updatedAt ? new Date(b.trip.updatedAt).getTime() : 0;
      const au = a.trip.updatedAt ? new Date(a.trip.updatedAt).getTime() : 0;
      return bu - au;
    });
    return past[0].trip;
  }

  return null;
}
