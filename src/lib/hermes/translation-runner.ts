import 'server-only';

import { HermesClientError, HermesQuotaError } from './errors';
import { readHermesConfig } from './client';
import { getHermesNetworkQuotaKey } from './quotas';
import { extractHermesText } from './result';
import { getHermesService } from './server';
import { hermesTranslationSchema } from './schemas';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const HERMES_TRANSLATION_BUDGET_MS = 30_000;
export const HERMES_TRANSLATION_POLL_INTERVAL_MS = 5_000;

function retryAfterMs(error: unknown): number | null {
  if (error instanceof HermesClientError && error.httpStatus === 429) {
    return (error.retryAfterSeconds ?? 5) * 1_000;
  }
  if (error instanceof HermesQuotaError) return error.retryAfterSeconds * 1_000;
  return null;
}

export interface TravelTranslationResult {
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
}

/**
 * Run a Gemma translation job to completion, server-side, within a time
 * budget — the same poll-to-completion shape as runTravelKnowledge, reused
 * here so the chat route's implicit translation routing (Swarm J4) preserves
 * the same 5-second polling, bounded Retry-After backoff, timeout, and quota
 * handling as the manual translate panel. Every failure mode (Hermes
 * disabled, quota exhausted, upstream error, timeout, bad payload) resolves
 * to `null` so the caller can fall back to a normal chat reply — translation
 * being unavailable must never surface as a chat error.
 */
export async function runTravelTranslation(
  headers: Headers,
  userId: string,
  input: { text: string; targetLanguage: string; sourceLanguage?: string },
  budgetMs = HERMES_TRANSLATION_BUDGET_MS
): Promise<TravelTranslationResult | null> {
  try {
    if (!readHermesConfig().enabled) return null;
  } catch {
    return null;
  }

  const payload = {
    input: input.text,
    target_language: input.targetLanguage,
    ...(input.sourceLanguage ? { source_language: input.sourceLanguage } : {}),
  };
  // Same budget the manual translate panel's request is held to — bypassing
  // the HTTP route here means this validation has to happen explicitly.
  const validated = hermesTranslationSchema.safeParse(payload);
  if (!validated.success) return null;

  const deadline = Date.now() + budgetMs;
  try {
    const service = getHermesService();
    const networkKey = getHermesNetworkQuotaKey(headers, userId);

    const created = await service.createJob({
      userId,
      networkKey,
      type: 'translate',
      payload: validated.data,
    });

    const toResult = (result: unknown): TravelTranslationResult | null => {
      const translatedText = extractHermesText(result);
      if (!translatedText) return null;
      return {
        translatedText,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      };
    };

    if (created.status === 'succeeded') return toResult(created.result);
    if (created.status === 'failed') return null;

    while (Date.now() < deadline) {
      const remainingBeforeSleep = deadline - Date.now();
      if (remainingBeforeSleep <= 0) break;
      await sleep(Math.min(HERMES_TRANSLATION_POLL_INTERVAL_MS, remainingBeforeSleep));

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
      if (polled.status === 'succeeded') return toResult(polled.result);
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
