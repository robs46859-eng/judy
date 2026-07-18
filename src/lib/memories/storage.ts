import 'server-only';

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Local disk storage for memory photos (single-server / Passenger deploy).
 * Files land under public/uploads/memories/<userId>/ and are served at
 * /uploads/memories/<userId>/<file>. Swap this module for an S3/R2 client
 * later without touching the routes — same two functions.
 */

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const UPLOADS_SUBPATH = path.join('uploads', 'memories');
const UPLOADS_ROOT = path.join(PUBLIC_ROOT, UPLOADS_SUBPATH);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

// ~10 MB decoded ceiling.
const MAX_BYTES = 10 * 1024 * 1024;

function safeUserSegment(userId: string): string {
  const cleaned = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned) throw new Error('Invalid user id for storage.');
  return cleaned;
}

/** Persist a base64 image and return its public URL. */
export async function saveMemoryImage(
  userId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) throw new Error('Unsupported image type.');

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    throw new Error('Image is empty or too large.');
  }

  const userSeg = safeUserSegment(userId);
  const dir = path.join(UPLOADS_ROOT, userSeg);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  // Public URL (POSIX separators regardless of host OS).
  return `/uploads/memories/${userSeg}/${filename}`;
}

/** Delete a previously stored memory image, if it lives under our uploads root. */
export async function deleteMemoryImage(imageUrl: string): Promise<void> {
  if (!imageUrl.startsWith('/uploads/memories/')) return;
  const rel = imageUrl.replace(/^\/+/, '');
  const abs = path.resolve(PUBLIC_ROOT, rel);
  // Path-traversal guard: must stay inside the uploads root.
  if (abs !== UPLOADS_ROOT && !abs.startsWith(UPLOADS_ROOT + path.sep)) return;
  try {
    await fs.unlink(abs);
  } catch {
    // already gone / never written — nothing to do
  }
}
