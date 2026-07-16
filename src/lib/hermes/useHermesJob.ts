'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useHermesJob — the shared client-side helper for the Hermes async job API.
 *
 * The Hermes endpoints are a queue: POST returns a 202 with a job_id, then you
 * GET /api/hermes/jobs/:id until the status is terminal. This hook hides that
 * submit → poll → timeout → error dance so every Gemma-backed feature
 * (translation, knowledge, ...) shares one implementation.
 *
 *   const { submit, status, result, error, isBusy } = useHermesJob('translate');
 *   await submit({ input, target_language: 'Spanish' });
 */

export type HermesJobType = 'translate' | 'knowledge';

export type HermesUiStatus =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'succeeded'
  | 'failed';

interface HermesJobResponse {
  job_id?: string;
  status?: 'queued' | 'running' | 'succeeded' | 'failed';
  result?: unknown;
  error?: string | null;
}

interface UseHermesJobOptions {
  /** Delay between status polls. Default 900ms. */
  pollIntervalMs?: number;
  /** Overall budget before giving up. Default 30s. */
  timeoutMs?: number;
}

const ENDPOINTS: Record<HermesJobType, string> = {
  translate: '/api/hermes/translate',
  knowledge: '/api/hermes/knowledge',
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useHermesJob(type: HermesJobType, options?: UseHermesJobOptions) {
  const pollIntervalMs = options?.pollIntervalMs ?? 900;
  const timeoutMs = options?.timeoutMs ?? 30_000;

  const [status, setStatus] = useState<HermesUiStatus>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  // Cancellation token for the in-flight run (also cancels on unmount).
  const runRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    return () => {
      if (runRef.current) runRef.current.cancelled = true;
    };
  }, []);

  const reset = useCallback(() => {
    if (runRef.current) runRef.current.cancelled = true;
    runRef.current = null;
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const submit = useCallback(
    async (payload: Record<string, unknown>): Promise<unknown> => {
      // Supersede any in-flight run.
      if (runRef.current) runRef.current.cancelled = true;
      const run = { cancelled: false };
      runRef.current = run;

      setStatus('submitting');
      setResult(null);
      setError(null);

      const fail = (message: string): null => {
        if (!run.cancelled) {
          setStatus('failed');
          setError(message);
        }
        return null;
      };

      const succeed = (value: unknown): unknown => {
        if (!run.cancelled) {
          setResult(value ?? null);
          setStatus('succeeded');
        }
        return value ?? null;
      };

      try {
        const res = await fetch(ENDPOINTS[type], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data: HermesJobResponse = await res.json().catch(() => ({}));

        if (!res.ok || !data.job_id) {
          return fail(data.error || `Request failed (${res.status}).`);
        }
        if (data.status === 'succeeded') return succeed(data.result);
        if (data.status === 'failed') return fail(data.error || 'The request failed.');

        if (!run.cancelled) setStatus('polling');
        const jobId = data.job_id;
        const deadline = Date.now() + timeoutMs;

        while (!run.cancelled && Date.now() < deadline) {
          await sleep(pollIntervalMs);
          if (run.cancelled) return null;

          const pollRes = await fetch(`/api/hermes/jobs/${encodeURIComponent(jobId)}`, {
            method: 'GET',
          });
          const pollData: HermesJobResponse = await pollRes.json().catch(() => ({}));

          if (!pollRes.ok) {
            // Rate-limited: back off and keep waiting. Other errors are fatal.
            if (pollRes.status === 429) continue;
            return fail(pollData.error || `Status check failed (${pollRes.status}).`);
          }
          if (pollData.status === 'succeeded') return succeed(pollData.result);
          if (pollData.status === 'failed') {
            return fail(pollData.error || 'The request failed.');
          }
        }

        if (run.cancelled) return null;
        return fail('Timed out waiting for a response.');
      } catch {
        return fail('Network error — please try again.');
      }
    },
    [type, pollIntervalMs, timeoutMs]
  );

  return {
    submit,
    reset,
    status,
    result,
    error,
    isBusy: status === 'submitting' || status === 'polling',
  };
}
