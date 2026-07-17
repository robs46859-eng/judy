import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AvatarStorageError,
  activateAvatar,
  getCurrentAvatar,
  readCurrentAvatar,
} from '../avatarStorage';

describe('avatarStorage', () => {
  let rootDir: string;
  const originalStorageDir = process.env.AVATAR_STORAGE_DIR;
  const now = () => new Date('2026-07-17T15:30:00.000Z');

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'judy-avatar-storage-'));
    delete process.env.AVATAR_STORAGE_DIR;
  });

  afterEach(async () => {
    if (originalStorageDir === undefined) delete process.env.AVATAR_STORAGE_DIR;
    else process.env.AVATAR_STORAGE_DIR = originalStorageDir;
    await rm(rootDir, { recursive: true, force: true });
  });

  it('stores content by SHA-256 and atomically publishes a sanitized manifest', async () => {
    const bytes = Buffer.from('glTF-version-one');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const report = { valid: true, capabilities: ['jaw'] };

    const manifest = await activateAvatar(
      {
        bytes,
        originalFilename: '../../private\\Travel Daddy 😈.GLB',
        report,
      },
      { rootDir, now }
    );

    expect(manifest).toEqual({
      sha256,
      filename: 'Travel-Daddy.glb',
      size: bytes.length,
      uploadedAt: '2026-07-17T15:30:00.000Z',
      report,
      modelUrl: `/api/avatar/model?v=${sha256.slice(0, 12)}`,
    });
    await expect(readFile(join(rootDir, 'versions', `${sha256}.glb`))).resolves.toEqual(bytes);

    const rawManifest = await readFile(join(rootDir, 'manifest', 'current.json'), 'utf8');
    expect(JSON.parse(rawManifest)).toEqual(manifest);
    expect(rawManifest).not.toContain('private');
  });

  it('returns null before an avatar has been activated', async () => {
    await expect(getCurrentAvatar({ rootDir })).resolves.toBeNull();
    await expect(readCurrentAvatar({ rootDir })).resolves.toBeNull();
  });

  it('reads and verifies the active avatar', async () => {
    const bytes = Buffer.from('glTF-active-avatar');
    const manifest = await activateAvatar(
      { bytes, originalFilename: 'judy.glb', report: { valid: true } },
      { rootDir, now }
    );

    await expect(readCurrentAvatar({ rootDir })).resolves.toEqual({ manifest, bytes });
  });

  it('preserves every prior version when a new avatar is activated', async () => {
    const firstBytes = Buffer.from('glTF-first');
    const secondBytes = Buffer.from('glTF-second');
    const first = await activateAvatar(
      { bytes: firstBytes, originalFilename: 'first.glb', report: { valid: true } },
      { rootDir, now }
    );
    const second = await activateAvatar(
      { bytes: secondBytes, originalFilename: 'second.glb', report: { valid: true } },
      { rootDir, now }
    );

    await expect(readFile(join(rootDir, 'versions', `${first.sha256}.glb`))).resolves.toEqual(
      firstBytes
    );
    await expect(readFile(join(rootDir, 'versions', `${second.sha256}.glb`))).resolves.toEqual(
      secondBytes
    );
    await expect(getCurrentAvatar({ rootDir })).resolves.toEqual(second);
  });

  it('keeps concurrent activations complete and content-addressed', async () => {
    const firstBytes = Buffer.from('glTF-concurrent-first');
    const secondBytes = Buffer.from('glTF-concurrent-second');
    const [first, second] = await Promise.all([
      activateAvatar(
        { bytes: firstBytes, originalFilename: 'first.glb', report: { valid: true } },
        { rootDir, now }
      ),
      activateAvatar(
        { bytes: secondBytes, originalFilename: 'second.glb', report: { valid: true } },
        { rootDir, now }
      ),
    ]);

    const current = await getCurrentAvatar({ rootDir });
    expect([first.sha256, second.sha256]).toContain(current?.sha256);
    await expect(readFile(join(rootDir, 'versions', `${first.sha256}.glb`))).resolves.toEqual(
      firstBytes
    );
    await expect(readFile(join(rootDir, 'versions', `${second.sha256}.glb`))).resolves.toEqual(
      secondBytes
    );
  });

  it('uses AVATAR_STORAGE_DIR when no root is injected', async () => {
    process.env.AVATAR_STORAGE_DIR = rootDir;
    const bytes = Buffer.from('glTF-from-env');

    const manifest = await activateAvatar({
      bytes,
      originalFilename: 'env.glb',
      report: null,
    }, { now });

    await expect(getCurrentAvatar()).resolves.toEqual(manifest);
  });

  it('rejects a tampered manifest instead of following a traversal digest', async () => {
    const manifestDir = join(rootDir, 'manifest');
    await mkdir(manifestDir, { recursive: true });
    await writeFile(
      join(manifestDir, 'current.json'),
      JSON.stringify({
        sha256: '../../outside',
        filename: '../outside.glb',
        size: 12,
        uploadedAt: '2026-07-17T15:30:00.000Z',
        report: {},
        modelUrl: '/api/avatar/model?v=../../outside',
      })
    );

    await expect(readCurrentAvatar({ rootDir })).rejects.toThrow(AvatarStorageError);
  });

  it('detects missing or corrupted version bytes', async () => {
    const bytes = Buffer.from('glTF-original');
    const manifest = await activateAvatar(
      { bytes, originalFilename: 'judy.glb', report: { valid: true } },
      { rootDir, now }
    );
    await writeFile(join(rootDir, 'versions', `${manifest.sha256}.glb`), 'corrupted');

    await expect(readCurrentAvatar({ rootDir })).rejects.toThrow(
      'The active avatar asset does not match its manifest.'
    );
  });
});
