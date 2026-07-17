import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readCurrentAvatar: vi.fn(),
  existsSync: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@/lib/avatar/avatarStorage', () => ({ readCurrentAvatar: mocks.readCurrentAvatar }));
vi.mock('node:fs', () => ({ existsSync: mocks.existsSync }));
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }));

import { GET } from '../route';

const sha256 = 'abcdef1234567890'.repeat(4);
const currentBytes = Buffer.from('current glTF bytes');
const current = {
  manifest: {
    sha256,
    filename: 'judy.glb',
    size: currentBytes.length,
    uploadedAt: '2026-07-17T15:30:00.000Z',
    report: { compatible: true },
    modelUrl: `/api/avatar/model?v=${sha256.slice(0, 12)}`,
  },
  bytes: currentBytes,
};

function request(query = '') {
  return new Request(`http://localhost/api/avatar/model${query}`) as NextRequest;
}

beforeEach(() => {
  mocks.readCurrentAvatar.mockReset().mockResolvedValue(current);
  mocks.existsSync.mockReset().mockReturnValue(false);
  mocks.readFile.mockReset().mockResolvedValue(Buffer.from('bundled glTF bytes'));
});

describe('GET /api/avatar/model', () => {
  it('serves the active GLB with immutable caching for its matching version prefix', async () => {
    const response = await GET(request(`?v=${sha256.slice(0, 12)}`));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('model/gltf-binary');
    expect(response.headers.get('Content-Length')).toBe(String(currentBytes.length));
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('ETag')).toBe(`"${sha256}"`);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(currentBytes);
  });

  it('uses no-cache when the version is absent or stale', async () => {
    expect((await GET(request())).headers.get('Cache-Control')).toBe('no-cache');
    expect((await GET(request('?v=000000000000'))).headers.get('Cache-Control')).toBe('no-cache');
  });

  it('redirects to the preferred bundled face when no upload is active', async () => {
    mocks.readCurrentAvatar.mockResolvedValue(null);
    mocks.existsSync.mockReturnValue(true);

    const response = await GET(request());
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost/models/judyface.glb');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('serves judyrig directly when no upload or preferred bundled face exists', async () => {
    mocks.readCurrentAvatar.mockResolvedValue(null);
    const bundled = Buffer.from('bundled glTF bytes');
    mocks.readFile.mockResolvedValue(bundled);

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bundled);
    expect(response.headers.get('Content-Type')).toBe('model/gltf-binary');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('falls back without leaking a corrupt-storage error', async () => {
    mocks.readCurrentAvatar.mockRejectedValue(new Error('/secret/path/current.json is corrupt'));
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('bundled glTF bytes');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('returns a generic 503 if both managed and bundled storage are unavailable', async () => {
    mocks.readCurrentAvatar.mockRejectedValue(new Error('managed unavailable'));
    mocks.readFile.mockRejectedValue(new Error('/secret/path/judyrig.glb missing'));

    const response = await GET(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Avatar model is temporarily unavailable',
    });
  });
});
