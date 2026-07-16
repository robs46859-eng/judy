import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateDestinationSeo } from '@/lib/seo/generate';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    destination: z.string().trim().min(1).max(160),
    audience: z.string().trim().min(1).max(160).optional(),
    contextChunks: z.array(z.string().trim().min(1).max(4_000)).max(16).optional(),
  })
  .strict();

/**
 * POST /api/seo/generate
 * Generates gay-travel SEO metadata (title, description, keywords, H1,
 * landing copy, JSON-LD) for a destination — Gemma-first, Gemini fallback.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'seo', { limit: 10, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid SEO request.' }, { status: 400 });
  }

  try {
    const seo = await generateDestinationSeo(request.headers, userId, parsed.data);
    return NextResponse.json(seo, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'SEO generation failed.' }, { status: 500 });
  }
}
