import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Good enough for a single-process deployment (Hostinger/Passenger).
 * If the app is ever scaled horizontally, replace with a shared store
 * (Redis / Upstash) — the call sites won't need to change.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Periodically drop stale buckets so the map doesn't grow unbounded.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(options.windowMs);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < options.windowMs);

  if (bucket.timestamps.length >= options.limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: options.limit - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/** Extracts a best-effort client identifier from the request. */
export function clientKey(request: NextRequest, scope: string, userId?: string | null): string {
  if (userId) return `${scope}:user:${userId}`;
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `${scope}:ip:${ip}`;
}

/**
 * Convenience guard for route handlers. Returns a 429 response when the
 * limit is exceeded, or null when the request may proceed.
 */
export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  options: RateLimitOptions,
  userId?: string | null
): NextResponse | null {
  const result = rateLimit(clientKey(request, scope, userId), options);
  if (result.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  );
}
