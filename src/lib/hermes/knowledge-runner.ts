import 'server-only';

import { HermesClientError, HermesQuotaError } from './errors';
import { readHermesConfig } from './client';
import { getHermesNetworkQuotaKey } from './quotas';
import { extractHermesText } from './result';
import { getHermesService } from './server';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const HERMES_KNOWLEDGE_BUDGET_MS = 30_000;
export const HERMES_KNOWLEDGE_POLL_INTERVAL_MS = 5_000;

function retryAfterMs(error: unknown): number | null {
  if (error instanceof HermesClientError && error.httpStatus === 429) {
    return (error.retryAfterSeconds ?? 5) * 1_000;
  }
  if (error instanceof HermesQuotaError) return error.retryAfterSeconds * 1_000;
  return null;
}

/**
 * Run a Gemma knowledge job to completion, server-side, within a time budget.
 *
 * Designed as a best-effort augmentation for request/response flows (e.g. the
 * Travel Daddy chat route): it submits a knowledge job and polls the local
 * service until the job is terminal or the budget elapses. EVERY failure mode —
 * Hermes disabled, quota exhausted, upstream error, bad result shape, timeout —
 * resolves to `null` so the caller can fall back (e.g. to Gemini) without ever
 * surfacing an error to the user.
 *
 * Note: knowledge has a low daily quota by design, so callers should treat a
 * `null` return as normal and expected, not exceptional.
 */
export async function runTravelKnowledge(
  headers: Headers,
  userId: string,
  input: { prompt: string; contextChunks: string[] },
  budgetMs = HERMES_KNOWLEDGE_BUDGET_MS
): Promise<string | null> {
  // Cheap early-out when the integration is turned off.
  try {
    if (!readHermesConfig().enabled) return null;
  } catch {
    return null;
  }

  const chunks = input.contextChunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
  if (input.prompt.trim().length === 0 || chunks.length === 0) return null;

  const deadline = Date.now() + budgetMs;
  try {
    const service = getHermesService();
    const networkKey = getHermesNetworkQuotaKey(headers, userId);

    const created = await service.createJob({
      userId,
      networkKey,
      type: 'knowledge',
      payload: { prompt: input.prompt, context_chunks: chunks },
    });

    if (created.status === 'succeeded') return extractHermesText(created.result);
    if (created.status === 'failed') return null;

    while (Date.now() < deadline) {
      const remainingBeforeSleep = deadline - Date.now();
      if (remainingBeforeSleep <= 0) break;
      await sleep(Math.min(HERMES_KNOWLEDGE_POLL_INTERVAL_MS, remainingBeforeSleep));

      let polled;
      try {
        polled = await service.getJob({
          userId,
          networkKey,
          localJobId: created.job_id,
        });
      } catch (error) {
        const retryMs = retryAfterMs(error);
        if (retryMs === null || Date.now() + retryMs >= deadline) return null;
        await sleep(retryMs);
        continue;
      }
      if (polled.status === 'succeeded') return extractHermesText(polled.result);
      if (polled.status === 'failed') return null;
    }

    try {
      await service.cancelJob({
        userId,
        networkKey,
        localJobId: created.job_id,
      });
    } catch {
      // A leased job cannot be canceled safely; the worker remains authoritative.
    }
    return null;
  } catch {
    // Quota, config, upstream, or validation error → fall back silently.
    return null;
  }
}
