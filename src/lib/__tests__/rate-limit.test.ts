import { describe, it, expect } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const key = `test-under-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { limit: 5, windowMs: 60_000 }).ok).toBe(true);
    }
  });

  it('blocks requests over the limit and reports retry time', () => {
    const key = `test-over-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, { limit: 3, windowMs: 60_000 });
    }
    const blocked = rateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks separate keys independently', () => {
    const a = `test-a-${Date.now()}`;
    const b = `test-b-${Date.now()}`;
    for (let i = 0; i < 3; i++) rateLimit(a, { limit: 3, windowMs: 60_000 });
    expect(rateLimit(a, { limit: 3, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit(b, { limit: 3, windowMs: 60_000 }).ok).toBe(true);
  });

  it('frees capacity after the window passes', () => {
    const key = `test-window-${Date.now()}`;
    rateLimit(key, { limit: 1, windowMs: 1 });
    // Window is 1ms — after it elapses the next call is allowed again.
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(rateLimit(key, { limit: 1, windowMs: 1 }).ok).toBe(true);
  });
});
