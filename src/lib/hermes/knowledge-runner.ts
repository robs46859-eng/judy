import 'server-only';

import { readHermesConfig } from './client';
import { getHermesNetworkQuotaKey } from './quotas';
import { extractHermesText } from './result';
import { getHermesService } from './server';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  budgetMs = 9_000
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

    const deadline = Date.now() + budgetMs;
    while (Date.now() < deadline) {
      await sleep(700);
      const polled = await service.getJob({
        userId,
        networkKey,
        localJobId: created.job_id,
      });
      if (polled.status === 'succeeded') return extractHermesText(polled.result);
      if (polled.status === 'failed') return null;
    }

    return null;
  } catch {
    // Quota, config, upstream, or validation error → fall back silently.
    return null;
  }
}
