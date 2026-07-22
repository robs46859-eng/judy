import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAvatarAdminEmail: vi.fn(),
  inspectGlb: vi.fn(),
  activateAvatar: vi.fn(),
  getCurrentAvatar: vi.fn(),
  rateLimit: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/avatar/adminAccess', () => ({ isAvatarAdminEmail: mocks.isAvatarAdminEmail }));
vi.mock('@/lib/avatar/glbInspector', () => ({ inspectGlb: mocks.inspectGlb }));
vi.mock('@/lib/avatar/avatarStorage', () => ({
  activateAvatar: mocks.activateAvatar,
  getCurrentAvatar: mocks.getCurrentAvatar,
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('node:fs', () => ({ existsSync: mocks.existsSync }));

import { GET, POST } from '../route';

const compatibleReport = {
  structurallyValid: true,
  compatible: true,
  lipSyncMode: 'jaw',
  issues: [],
  warnings: [],
};

function getRequest(headers?: HeadersInit) {
  return new Request('http://localhost/api/admin/avatar', { headers }) as NextRequest;
}

function postRequest(file?: File, origin = 'http://localhost') {
  const form = new FormData();
  if (file) form.set('avatar', file);
  return new Request('http://localhost/api/admin/avatar', {
    method: 'POST',
    headers: { Origin: origin },
    body: form,
  }) as NextRequest;
}

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ user: { email: 'Admin@Example.com' } });
  mocks.isAvatarAdminEmail.mockReset().mockReturnValue(true);
  mocks.inspectGlb.mockReset().mockReturnValue(compatibleReport);
  mocks.activateAvatar.mockReset().mockResolvedValue({
    sha256: 'a'.repeat(64),
    filename: 'judy.glb',
    size: 4,
    uploadedAt: '2026-07-17T15:30:00.000Z',
    report: compatibleReport,
    modelUrl: `/api/avatar/model?v=${'a'.repeat(12)}`,
  });
  mocks.getCurrentAvatar.mockReset().mockResolvedValue(null);
  mocks.rateLimit.mockReset().mockReturnValue({ ok: true, remaining: 9, retryAfterSeconds: 0 });
  mocks.existsSync.mockReset().mockReturnValue(false);
});

describe('GET /api/admin/avatar', () => {
  it('requires a signed-in session', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await GET(getRequest());
    expect(response.status).toBe(401);
  });

  it('rejects a signed-in user who is not an avatar admin', async () => {
    mocks.isAvatarAdminEmail.mockReturnValue(false);
    const response = await GET(getRequest());
    expect(response.status).toBe(403);
  });

  it('rejects a cross-origin request when Origin is present', async () => {
    const response = await GET(getRequest({ Origin: 'https://evil.example' }));
    expect(response.status).toBe(403);
    expect(mocks.getCurrentAvatar).not.toHaveBeenCalled();
  });

  it('returns the current manifest and whichever bundled model is available', async () => {
    const current = { sha256: 'b'.repeat(64), modelUrl: '/api/avatar/model?v=bbbbbbbbbbbb' };
    mocks.getCurrentAvatar.mockResolvedValue(current);

    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      current,
      bundled: { modelUrl: '/models/judyrig.glb' },
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    mocks.existsSync.mockReturnValue(true);
    const withFace = await GET(getRequest());
    expect((await withFace.json()).bundled.modelUrl).toBe('/models/agreejudy.glb');
  });
});

describe('POST /api/admin/avatar', () => {
  it('enforces the per-admin ten-per-hour rate limit before reading the upload', async () => {
    mocks.rateLimit.mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 120 });
    const response = await POST(postRequest(new File(['glTF'], 'judy.glb')));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(mocks.rateLimit).toHaveBeenCalledWith('admin-avatar-upload:admin@example.com', {
      limit: 10,
      windowMs: 3_600_000,
    });
    expect(mocks.inspectGlb).not.toHaveBeenCalled();
  });

  it('requires the avatar field and a nonempty .glb filename', async () => {
    expect((await POST(postRequest())).status).toBe(400);
    expect((await POST(postRequest(new File(['data'], 'judy.fbx')))).status).toBe(400);
    expect((await POST(postRequest(new File([], 'judy.glb')))).status).toBe(400);
    expect(mocks.inspectGlb).not.toHaveBeenCalled();
  });

  it('rejects an upload over 25 MiB before inspection', async () => {
    const tooLarge = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.glb');
    const response = await POST(postRequest(tooLarge));
    expect(response.status).toBe(413);
    expect(mocks.inspectGlb).not.toHaveBeenCalled();
  });

  it('returns the inspection report and never activates an incompatible GLB', async () => {
    const report = { ...compatibleReport, compatible: false, lipSyncMode: 'none' };
    mocks.inspectGlb.mockReturnValue(report);

    const response = await POST(postRequest(new File(['glTF'], 'static.glb')));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: 'The GLB is invalid or incompatible with Judy lip sync',
      report,
    });
    expect(mocks.activateAvatar).not.toHaveBeenCalled();
  });

  it('inspects and activates a compatible GLB', async () => {
    const file = new File(['glTF'], '../../Judy Face.glb');
    const response = await POST(postRequest(file));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.inspectGlb).toHaveBeenCalledWith(Buffer.from('glTF'));
    expect(mocks.activateAvatar).toHaveBeenCalledWith({
      bytes: Buffer.from('glTF'),
      originalFilename: file.name,
      report: compatibleReport,
    });
    expect(body.report).toEqual(compatibleReport);
    expect(body.current.modelUrl).toContain('/api/avatar/model?v=');
  });
});
