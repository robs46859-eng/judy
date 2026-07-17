import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

import { readCurrentAvatar, type StoredAvatar } from '@/lib/avatar/avatarStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERSION_PREFIX_LENGTH = 12;

function modelResponse(
  bytes: Buffer,
  sha256: string,
  cacheControl: string
): NextResponse {
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'model/gltf-binary',
      'Content-Length': String(bytes.length),
      'X-Content-Type-Options': 'nosniff',
      ETag: `"${sha256}"`,
      'Cache-Control': cacheControl,
    },
  });
}

async function bundledFallback(): Promise<NextResponse> {
  const facePath = join(process.cwd(), 'public', 'models', 'judyface.glb');
  if (existsSync(facePath)) {
    try {
      const bytes = await readFile(facePath);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      return modelResponse(bytes, sha256, 'no-cache');
    } catch {
      // Fall through to the older bundled model if the preferred file is
      // present but temporarily unreadable.
    }
  }

  try {
    const bytes = await readFile(join(process.cwd(), 'public', 'models', 'judyrig.glb'));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return modelResponse(bytes, sha256, 'no-cache');
  } catch {
    return NextResponse.json(
      { error: 'Avatar model is temporarily unavailable' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
}

function requestMatchesCurrentVersion(request: NextRequest, current: StoredAvatar): boolean {
  const requested = new URL(request.url).searchParams.get('v');
  return requested === current.manifest.sha256.slice(0, VERSION_PREFIX_LENGTH);
}

export async function GET(request: NextRequest) {
  let current: StoredAvatar | null;
  try {
    current = await readCurrentAvatar();
  } catch {
    return bundledFallback();
  }

  if (!current) return bundledFallback();

  return modelResponse(
    current.bytes,
    current.manifest.sha256,
    requestMatchesCurrentVersion(request, current)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'
  );
}
