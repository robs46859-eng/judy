import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getHermesService: vi.fn(),
  createJob: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock('@/lib/hermes/server', () => ({ getHermesService: mocks.getHermesService }));

import { GET as getStatus } from '../jobs/[id]/route';
import { POST as createKnowledge } from '../knowledge/route';
import { POST as createTranslation } from '../translate/route';

const localId = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  mocks.getSessionUserId.mockReset();
  mocks.getHermesService.mockReset();
  mocks.createJob.mockReset();
  mocks.getJob.mockReset();
  mocks.getHermesService.mockReturnValue({
    createJob: mocks.createJob,
    getJob: mocks.getJob,
  });
});

describe('Hermes route authentication', () => {
  it('rejects an unauthenticated create before reading JSON or creating a service', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const request = new Request('http://localhost/api/hermes/translate', {
      method: 'POST',
      body: 'not-json',
    }) as NextRequest;

    const response = await createTranslation(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
    expect(mocks.getHermesService).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated status request before service lookup', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const request = new Request(
      `http://localhost/api/hermes/jobs/${localId}`
    ) as NextRequest;

    const response = await getStatus(request, { params: Promise.resolve({ id: localId }) });

    expect(response.status).toBe(401);
    expect(mocks.getHermesService).not.toHaveBeenCalled();
  });
});

describe('Hermes route response shaping', () => {
  it('returns only the local ID from create responses', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.createJob.mockResolvedValue({
      job_id: localId,
      bridgeJobId: 'bridge-private',
      status: 'queued',
      result: null,
      error: null,
    });
    const request = new Request('http://localhost/api/hermes/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.5' },
      body: JSON.stringify({
        prompt: 'Question',
        context_chunks: ['Grounded travel context.'],
      }),
    }) as NextRequest;

    const response = await createKnowledge(request);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({ job_id: localId, status: 'queued' });
    expect(JSON.stringify(body)).not.toContain('bridge-private');
  });

  it('whitelists status fields even if an internal object has a bridge ID', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.getJob.mockResolvedValue({
      job_id: localId,
      bridgeJobId: 'bridge-private',
      status: 'succeeded',
      result: { answer: 'Done' },
      error: null,
    });
    const request = new Request(
      `http://localhost/api/hermes/jobs/${localId}`,
      { headers: { 'x-forwarded-for': '192.0.2.5' } }
    ) as NextRequest;

    const response = await getStatus(request, { params: Promise.resolve({ id: localId }) });
    const body = await response.json();

    expect(body).toEqual({
      job_id: localId,
      status: 'succeeded',
      result: { answer: 'Done' },
      error: null,
    });
    expect(JSON.stringify(body)).not.toContain('bridge-private');
  });
});
