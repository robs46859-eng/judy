import { describe, expect, it } from 'vitest';
import {
  consumeHermesMinuteQuotas,
  type ConsumeHermesMinuteQuotaInput,
  getHermesNetworkQuotaKey,
  type HermesMinuteQuotaStore,
  type MinuteQuotaResult,
  utcDayRange,
} from '../quotas';

class MemoryQuotaStore implements HermesMinuteQuotaStore {
  readonly buckets = new Map<string, { windowStart: string; count: number }>();

  async consumeMinuteQuota(
    input: ConsumeHermesMinuteQuotaInput
  ): Promise<MinuteQuotaResult> {
    const current = this.buckets.get(input.key);
    const count = current?.windowStart === input.windowStart ? current.count : 0;
    if (count >= input.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: input.retryAfterSeconds,
      };
    }

    const nextCount = count + 1;
    this.buckets.set(input.key, { windowStart: input.windowStart, count: nextCount });
    return { ok: true, remaining: input.limit - nextCount, retryAfterSeconds: 0 };
  }
}

const windowStart = new Date('2026-07-15T12:00:00.000Z');

describe('Hermes minute quotas', () => {
  it('enforces five creates per user in a shared store', async () => {
    const store = new MemoryQuotaStore();

    for (let index = 0; index < 5; index += 1) {
      await expect(
        consumeHermesMinuteQuotas(store, 'create', 'user-a', 'ip:192.0.2.1', windowStart)
      ).resolves.toMatchObject({ ok: true });
    }
    await expect(
      consumeHermesMinuteQuotas(store, 'create', 'user-a', 'ip:192.0.2.1', windowStart)
    ).resolves.toMatchObject({
      ok: false,
      blockedScope: 'user',
      retryAfterSeconds: 60,
    });

    await expect(
      consumeHermesMinuteQuotas(
        store,
        'create',
        'user-a',
        'ip:192.0.2.1',
        new Date(windowStart.getTime() + 60_000)
      )
    ).resolves.toMatchObject({ ok: true });
  });

  it('enforces the IP create cap across distinct authenticated users', async () => {
    const store = new MemoryQuotaStore();
    const networkKey = 'ip:198.51.100.4';

    for (let index = 0; index < 30; index += 1) {
      const userId = `user-${Math.floor(index / 5)}`;
      const result = await consumeHermesMinuteQuotas(
        store,
        'create',
        userId,
        networkKey,
        windowStart
      );
      expect(result.ok).toBe(true);
    }

    await expect(
      consumeHermesMinuteQuotas(store, 'create', 'user-next', networkKey, windowStart)
    ).resolves.toMatchObject({ ok: false, blockedScope: 'ip' });
  });

  it('keeps create and status buckets independent and hashes stored identities', async () => {
    const store = new MemoryQuotaStore();
    for (let index = 0; index < 5; index += 1) {
      await consumeHermesMinuteQuotas(
        store,
        'create',
        'user-a',
        'ip:203.0.113.8',
        windowStart
      );
    }

    await expect(
      consumeHermesMinuteQuotas(store, 'create', 'user-a', 'ip:203.0.113.8', windowStart)
    ).resolves.toMatchObject({ ok: false });
    await expect(
      consumeHermesMinuteQuotas(store, 'status', 'user-a', 'ip:203.0.113.8', windowStart)
    ).resolves.toMatchObject({ ok: true });
    expect([...store.buckets.keys()].join()).not.toContain('user-a');
    expect([...store.buckets.keys()].join()).not.toContain('203.0.113.8');
  });
});

describe('Hermes quota helpers', () => {
  it('uses only the proxy-appended rightmost address and otherwise falls back to the user', () => {
    expect(
      getHermesNetworkQuotaKey(
        new Headers({ 'x-forwarded-for': '192.0.2.10, 198.51.100.2' }),
        'user-a'
      )
    ).toBe('ip:198.51.100.2');
    expect(
      getHermesNetworkQuotaKey(
        new Headers({
          'x-forwarded-for': '203.0.113.99, 198.51.100.2',
          'x-real-ip': '192.0.2.200',
        }),
        'user-a'
      )
    ).toBe('ip:198.51.100.2');
    expect(
      getHermesNetworkQuotaKey(new Headers({ 'x-forwarded-for': 'not-an-ip' }), 'user-a')
    ).toBe('user:user-a');
    expect(
      getHermesNetworkQuotaKey(new Headers({ 'x-real-ip': '192.0.2.200' }), 'user-a')
    ).toBe('user:user-a');
  });

  it('builds UTC day boundaries independent of local timezone', () => {
    const range = utcDayRange(new Date('2026-07-15T23:59:59.500Z'));
    expect(range.start.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });
});
