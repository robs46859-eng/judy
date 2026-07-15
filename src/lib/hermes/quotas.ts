import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const HERMES_QUOTA_WINDOW_MS = 60_000;
export const HERMES_CREATE_USER_LIMIT = 5;
export const HERMES_CREATE_IP_LIMIT = 30;
export const HERMES_STATUS_USER_LIMIT = 60;
export const HERMES_STATUS_IP_LIMIT = 60;
export const HERMES_DAILY_LIMITS = {
  translate: 20,
  knowledge: 10,
} as const;

export type HermesQuotaAction = 'create' | 'status';
export type HermesMinuteQuotaScope = 'user' | 'ip';

export type MinuteQuotaResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type DualMinuteQuotaResult = MinuteQuotaResult & {
  blockedScope?: HermesMinuteQuotaScope;
};

export type ConsumeHermesMinuteQuotaInput = {
  key: string;
  windowStart: string;
  limit: number;
  retryAfterSeconds: number;
};

export interface HermesMinuteQuotaStore {
  consumeMinuteQuota(input: ConsumeHermesMinuteQuotaInput): Promise<MinuteQuotaResult>;
}

function minuteLimits(action: HermesQuotaAction): { user: number; ip: number } {
  return action === 'create'
    ? { user: HERMES_CREATE_USER_LIMIT, ip: HERMES_CREATE_IP_LIMIT }
    : { user: HERMES_STATUS_USER_LIMIT, ip: HERMES_STATUS_IP_LIMIT };
}

function quotaWindow(now: Date): { windowStart: string; retryAfterSeconds: number } {
  const nowMs = now.getTime();
  const windowNumber = Math.floor(nowMs / HERMES_QUOTA_WINDOW_MS);
  const windowEnd = (windowNumber + 1) * HERMES_QUOTA_WINDOW_MS;
  return {
    windowStart: String(windowNumber),
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1_000)),
  };
}

function quotaStorageKey(
  action: HermesQuotaAction,
  scope: HermesMinuteQuotaScope,
  identity: string
): string {
  return createHash('sha256')
    .update(`hermes-minute-v1\0${action}\0${scope}\0${identity}`)
    .digest('hex');
}

export async function consumeHermesMinuteQuotas(
  store: HermesMinuteQuotaStore,
  action: HermesQuotaAction,
  userId: string,
  networkIdentity: string,
  now: Date
): Promise<DualMinuteQuotaResult> {
  const limits = minuteLimits(action);
  const window = quotaWindow(now);
  const userResult = await store.consumeMinuteQuota({
    key: quotaStorageKey(action, 'user', userId),
    windowStart: window.windowStart,
    limit: limits.user,
    retryAfterSeconds: window.retryAfterSeconds,
  });
  if (!userResult.ok) return { ...userResult, blockedScope: 'user' };

  const ipResult = await store.consumeMinuteQuota({
    key: quotaStorageKey(action, 'ip', networkIdentity),
    windowStart: window.windowStart,
    limit: limits.ip,
    retryAfterSeconds: window.retryAfterSeconds,
  });
  if (!ipResult.ok) return { ...ipResult, blockedScope: 'ip' };

  return {
    ok: true,
    remaining: Math.min(userResult.remaining, ipResult.remaining),
    retryAfterSeconds: 0,
  };
}

function normalizeIp(value: string): string | null {
  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6) return null;

  try {
    const hostname = new URL(`http://[${value}]/`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  } catch {
    return null;
  }
}

export function getHermesNetworkQuotaKey(headers: Headers, userId: string): string {
  // Hostinger typically forwards the connection proxy chain in x-forwarded-for.
  // We use the rightmost IP (the immediate proxy) as a conservative trust boundary.
  const fallback = `user:${userId}`;
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded || forwarded.length > 512) return fallback;

  const chain = forwarded.split(',');
  if (chain.length > 16) return fallback;

  const rightmost = chain.at(-1)?.trim();
  if (!rightmost || rightmost.length > 64) return fallback;

  const normalized = normalizeIp(rightmost);
  return normalized ? `ip:${normalized}` : fallback;
}

export function utcDayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function secondsUntilUtcDayEnd(now: Date): number {
  return Math.max(1, Math.ceil((utcDayRange(now).end.getTime() - now.getTime()) / 1000));
}
