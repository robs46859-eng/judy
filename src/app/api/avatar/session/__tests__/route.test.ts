import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSessionUserId: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSessionUserId: mocks.getSessionUserId }));

import { POST } from '../route';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
  delete process.env.HEYGEN_API_KEY;
  delete process.env.HEYGEN_AVATAR_ID;
  delete process.env.HEYGEN_VOICE_ID;
}

function request(ip = '192.0.2.10') {
  return new Request('http://localhost/api/avatar/session', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  }) as NextRequest;
}

function heygenOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: { session_id: 'sess-1', url: 'wss://example.com', access_token: 'token-1' },
    }),
    text: async () => '',
  };
}

beforeEach(() => {
  resetEnv();
  mocks.getSessionUserId.mockReset();
});

afterEach(() => {
  resetEnv();
  vi.unstubAllGlobals();
});

describe('POST /api/avatar/session', () => {
  it('requires authentication', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
  });

  it('returns 501 when HEYGEN_API_KEY is not configured', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    const response = await POST(request());
    expect(response.status).toBe(501);
  });

  it('omits avatar_name/voice from the HeyGen request when the env vars are unset', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    process.env.HEYGEN_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => heygenOk());
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request());
    expect(response.status).toBe(200);

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.avatar_name).toBeUndefined();
    expect(body.voice).toBeUndefined();
  });

  it('includes avatar_name and voice.voice_id when HEYGEN_AVATAR_ID/HEYGEN_VOICE_ID are set', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    process.env.HEYGEN_API_KEY = 'test-key';
    process.env.HEYGEN_AVATAR_ID = 'avatar-42';
    process.env.HEYGEN_VOICE_ID = 'voice-99';
    const fetchMock = vi.fn(async () => heygenOk());
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request());
    expect(response.status).toBe(200);

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.avatar_name).toBe('avatar-42');
    expect(body.voice).toEqual({ voice_id: 'voice-99' });
  });
});
