import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import {
  HermesClientError,
  HermesConfigError,
  HermesNotFoundError,
  HermesQuotaError,
  HermesSubmissionError,
} from './errors';
import { getHermesNetworkQuotaKey } from './quotas';
import type { HermesJobType, HermesPayloadByType } from './schemas';
import { getHermesService } from './server';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

function json(body: unknown, status: number, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...noStoreHeaders, ...headers },
  });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof HermesQuotaError) {
    return json(
      { error: 'Hermes request quota exceeded.' },
      error.httpStatus,
      { 'Retry-After': String(error.retryAfterSeconds) }
    );
  }
  if (error instanceof HermesNotFoundError) {
    return json({ error: 'Hermes job not found.' }, error.httpStatus);
  }
  if (error instanceof HermesSubmissionError) {
    return json(
      {
        job_id: error.localJobId,
        status: 'failed',
        error: error.publicMessage,
      },
      error.httpStatus
    );
  }
  if (error instanceof HermesConfigError) {
    return json({ error: error.publicMessage }, error.httpStatus);
  }
  if (error instanceof HermesClientError) {
    return json({ error: error.publicMessage }, error.httpStatus);
  }

  console.error('Hermes route failed.');
  return json({ error: 'Hermes request failed.' }, 500);
}

export async function handleHermesCreate<T extends HermesJobType>(
  request: NextRequest,
  type: T,
  schema: z.ZodType<HermesPayloadByType[T]>
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return json({ error: 'Authentication required' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Invalid Hermes request.' }, 400);
  }

  try {
    const job = await getHermesService().createJob({
      userId,
      networkKey: getHermesNetworkQuotaKey(request.headers, userId),
      type,
      payload: parsed.data,
    });
    return json({ job_id: job.job_id, status: job.status }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleHermesStatus(
  request: NextRequest,
  localJobId: string
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return json({ error: 'Authentication required' }, 401);

  try {
    const job = await getHermesService().getJob({
      userId,
      networkKey: getHermesNetworkQuotaKey(request.headers, userId),
      localJobId,
    });
    return json(
      {
        job_id: job.job_id,
        status: job.status,
        result: job.result,
        error: job.error,
      },
      200
    );
  } catch (error) {
    return errorResponse(error);
  }
}
