/**
 * Pure countdown calculation for the trip countdown widget.
 *
 * Kept as a plain synchronous function (rather than inline in a
 * `setInterval` callback) so the caller can seed state immediately on trip
 * load instead of showing an empty widget until the first one-second tick.
 */

export interface CountdownParts {
  days: number;
  hours: number;
  mins: number;
}

export function computeCountdown(
  departureDate: string | Date | null | undefined,
  now: number = Date.now()
): CountdownParts | null {
  if (!departureDate) return null;

  const dep = new Date(departureDate).getTime();
  if (!Number.isFinite(dep)) return null;

  const diff = dep - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, mins: 0 };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  };
}
