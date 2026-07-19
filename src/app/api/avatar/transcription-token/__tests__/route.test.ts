import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUserId: mocks.getSessionUserId }));

import { POST } from '../route';

function request() {
  return new Request('http://localhost/api/avatar/transcription-token', {
    method: 'POST',
    headers: { 'x-forwarded-for': '192.0.2.50' },
  }) as NextRequest;
}

beforeEach(() => {
  mocks.getSessionUserId.mockReset();
  vi.unstubAllGlobals();
  delete process.env.ELEVENLABS_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ELEVENLABS_API_KEY;
});

describe('POST /api/avatar/transcription-token', () => {
  it('requires an authenticated user', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
  });

  it('reports an unconfigured fallback without making an upstream request', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request());
    expect(response.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mints a short-lived Scribe token without returning the provider key', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    process.env.ELEVENLABS_API_KEY = 'server-secret-key';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'single-use-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ token: 'single-use-token' });
    expect(JSON.stringify(body)).not.toContain('server-secret-key');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'xi-api-key': 'server-secret-key' }),
      })
    );
  });

  it.each([
    [429, 429],
    [500, 502],
  ])('maps upstream status %s to safe status %s', async (upstreamStatus, expectedStatus) => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    process.env.ELEVENLABS_API_KEY = 'server-secret-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream detail', { status: upstreamStatus })));

    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(expectedStatus);
    expect(body.error).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain('upstream detail');
  });

  it('rejects a malformed token response', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    process.env.ELEVENLABS_API_KEY = 'server-secret-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const response = await POST(request());
    expect(response.status).toBe(502);
  });
});
