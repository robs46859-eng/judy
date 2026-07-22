import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { isAvatarAdminEmail } from '@/lib/avatar/adminAccess';
import { inspectGlb } from '@/lib/avatar/glbInspector';
import {
  activateAvatar,
  getCurrentAvatar,
  type JsonValue,
} from '@/lib/avatar/avatarStorage';
import { rateLimit } from '@/lib/rate-limit';
import { BUNDLED_AVATAR_MODEL_URL } from '@/lib/avatar/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_AVATAR_BYTES = 25 * 1024 * 1024;
const UPLOAD_LIMIT = 10;
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;

function json(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function requestIsSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function authorizedAdminEmail(
  request: NextRequest
): Promise<{ email: string } | { response: NextResponse }> {
  const session = await auth();
  if (!session?.user) {
    return { response: json({ error: 'Authentication required' }, { status: 401 }) };
  }

  const email = session.user.email?.trim().toLowerCase();
  if (!email || !isAvatarAdminEmail(email)) {
    return { response: json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (!requestIsSameOrigin(request)) {
    return { response: json({ error: 'Cross-origin request rejected' }, { status: 403 }) };
  }

  return { email };
}

function bundledModelUrl(): string {
  const preferredPath = join(
    process.cwd(),
    'public',
    BUNDLED_AVATAR_MODEL_URL.replace(/^\/+/, '')
  );
  return existsSync(preferredPath) ? BUNDLED_AVATAR_MODEL_URL : '/models/judyrig.glb';
}

export async function GET(request: NextRequest) {
  const authorization = await authorizedAdminEmail(request);
  if ('response' in authorization) return authorization.response;

  try {
    const current = await getCurrentAvatar();
    return json({ current, bundled: { modelUrl: bundledModelUrl() } });
  } catch {
    return json({ error: 'Avatar storage is temporarily unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizedAdminEmail(request);
  if ('response' in authorization) return authorization.response;

  const limited = rateLimit(`admin-avatar-upload:${authorization.email}`, {
    limit: UPLOAD_LIMIT,
    windowMs: UPLOAD_WINDOW_MS,
  });
  if (!limited.ok) {
    return json(
      { error: 'Too many avatar uploads. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfterSeconds) },
      }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Expected a multipart form upload' }, { status: 400 });
  }

  const value = form.get('avatar');
  if (!(value instanceof File)) {
    return json({ error: 'The avatar file is required' }, { status: 400 });
  }
  if (!value.name.toLowerCase().endsWith('.glb')) {
    return json({ error: 'The avatar must be a .glb file' }, { status: 400 });
  }
  if (value.size === 0) {
    return json({ error: 'The avatar file must not be empty' }, { status: 400 });
  }
  if (value.size > MAX_AVATAR_BYTES) {
    return json({ error: 'The avatar file exceeds the 25 MiB limit' }, { status: 413 });
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await value.arrayBuffer());
  } catch {
    return json({ error: 'The avatar file could not be read' }, { status: 400 });
  }
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) {
    return json(
      { error: bytes.length === 0 ? 'The avatar file must not be empty' : 'The avatar file exceeds the 25 MiB limit' },
      { status: bytes.length === 0 ? 400 : 413 }
    );
  }

  const report = inspectGlb(bytes);
  if (!report.structurallyValid || !report.compatible) {
    return json(
      { error: 'The GLB is invalid or incompatible with Judy lip sync', report },
      { status: 422 }
    );
  }

  try {
    const current = await activateAvatar({
      bytes,
      originalFilename: value.name,
      report: report as unknown as JsonValue,
    });
    return json({ current, report });
  } catch {
    return json({ error: 'The avatar could not be activated' }, { status: 500 });
  }
}
