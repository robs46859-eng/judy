import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}));

import { GET, PATCH } from '../route';

function jsonRequest(body: unknown, ip = '192.0.2.10', method = 'PATCH') {
  return new Request('http://localhost/api/user/preferences', {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  mocks.getSessionUserId.mockReset();
  mocks.findUnique.mockReset();
  mocks.update.mockReset();
});

describe('GET /api/user/preferences', () => {
  it('requires authentication', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const request = new Request('http://localhost/api/user/preferences') as NextRequest;

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns the signed-in user's own preferences, scoped by session id", async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.findUnique.mockResolvedValue({
      nativeLanguage: 'English',
      translationLanguage: null,
      travelRoute: null,
      preTravelTasks: null,
      helpPreference: null,
      voiceId: null,
      spokenLanguage: 'es-ES',
      onboardingCompletedAt: null,
    });
    const request = new Request('http://localhost/api/user/preferences', {
      headers: { 'x-forwarded-for': '192.0.2.10' },
    }) as NextRequest;

    const response = await GET(request);
    const body = await response.json();

    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-a' },
        select: expect.objectContaining({ spokenLanguage: true }),
      })
    );
    expect(body.nativeLanguage).toBe('English');
    expect(body.spokenLanguage).toBe('es-ES');
    expect(body.onboardingCompletedAt).toBeNull();
  });
});

describe('PATCH /api/user/preferences', () => {
  it('requires authentication', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const response = await PATCH(jsonRequest({ nativeLanguage: 'English' }));
    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects unknown fields instead of silently passing them through', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    const response = await PATCH(
      jsonRequest({ nativeLanguage: 'English', isAdmin: true })
    );

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('never trusts a client-supplied onboardingCompletedAt', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    const response = await PATCH(
      jsonRequest({ onboardingCompletedAt: '1999-01-01T00:00:00.000Z' })
    );

    // Not a whitelisted field — the schema is `.strict()`.
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('sets onboardingCompletedAt server-side from completeOnboarding, scoped to the session user', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.update.mockResolvedValue({
      nativeLanguage: 'English',
      translationLanguage: 'Spanish',
      travelRoute: 'NYC to Madrid',
      preTravelTasks: null,
      helpPreference: null,
      voiceId: null,
      spokenLanguage: null,
      onboardingCompletedAt: new Date('2026-07-16T00:00:00.000Z'),
    });

    const response = await PATCH(
      jsonRequest({
        nativeLanguage: 'English',
        translationLanguage: 'Spanish',
        travelRoute: 'NYC to Madrid',
        completeOnboarding: true,
      })
    );

    expect(response.status).toBe(200);
    const [[callArgs]] = mocks.update.mock.calls;
    expect(callArgs.where).toEqual({ id: 'user-a' });
    expect(callArgs.data.nativeLanguage).toBe('English');
    expect(callArgs.data.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('accepts a voiceId from the approved catalog', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.update.mockResolvedValue({
      nativeLanguage: null,
      translationLanguage: null,
      travelRoute: null,
      preTravelTasks: null,
      helpPreference: null,
      voiceId: 'travel-daddy-warm-en',
      spokenLanguage: null,
      onboardingCompletedAt: null,
    });

    const response = await PATCH(jsonRequest({ voiceId: 'travel-daddy-warm-en' }));

    expect(response.status).toBe(200);
    const [[callArgs]] = mocks.update.mock.calls;
    expect(callArgs.data.voiceId).toBe('travel-daddy-warm-en');
  });

  it('rejects a voiceId that is not in the approved catalog', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    const response = await PATCH(jsonRequest({ voiceId: 'some-unapproved-provider-id' }));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('accepts and trims a nullable spokenLanguage preference', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.update.mockResolvedValue({ spokenLanguage: 'es-ES' });

    const response = await PATCH(jsonRequest({ spokenLanguage: '  es-ES  ' }));

    expect(response.status).toBe(200);
    const [[callArgs]] = mocks.update.mock.calls;
    expect(callArgs.where).toEqual({ id: 'user-a' });
    expect(callArgs.data.spokenLanguage).toBe('es-ES');
  });

  it('allows spokenLanguage to be cleared', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.update.mockResolvedValue({ spokenLanguage: null });

    const response = await PATCH(jsonRequest({ spokenLanguage: null }));

    expect(response.status).toBe(200);
    const [[callArgs]] = mocks.update.mock.calls;
    expect(callArgs.data.spokenLanguage).toBeNull();
  });

  it('rejects an empty spokenLanguage value', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');

    const response = await PATCH(jsonRequest({ spokenLanguage: '   ' }));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects a spoken language outside Judy Pierre\'s supported catalog', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');

    const response = await PATCH(jsonRequest({ spokenLanguage: 'Klingon' }));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects a malformed JSON body', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    const request = new Request('http://localhost/api/user/preferences', {
      method: 'PATCH',
      body: 'not-json',
    }) as NextRequest;

    const response = await PATCH(request);
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
