import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/memories/caption
 * Generates a travel-memory caption, alt text, and tags for a photo.
 *
 * Captioning requires *seeing* the image, so this uses a Gemini vision model
 * (multimodal) — Gemma is text-only and can't do image understanding. Returns
 * a deterministic fallback if the model is unavailable or returns no usable JSON.
 */

// ~8 MB of base64 ≈ ~6 MB image.
const MAX_BASE64_CHARS = 8 * 1024 * 1024;

const bodySchema = z
  .object({
    imageBase64: z.string().min(16).max(MAX_BASE64_CHARS),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    location: z.string().trim().max(160).optional(),
    context: z.string().trim().max(500).optional(),
  })
  .strict();

interface CaptionResult {
  caption: string;
  altText: string;
  tags: string[];
}

function extractJson(text: string | null): unknown | null {
  if (!text) return null;
  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}

const resultSchema = z.object({
  caption: z.string().min(1),
  altText: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

function normalize(raw: unknown): CaptionResult | null {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;
  return {
    caption: data.caption.trim().slice(0, 400),
    altText: (data.altText ?? data.caption).trim().slice(0, 300),
    tags: Array.from(
      new Set((data.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))
    ).slice(0, 12),
  };
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'memories-caption', { limit: 15, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid caption request.' }, { status: 400 });
  }
  const { imageBase64, mimeType, location, context } = parsed.data;

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Image captioning is not configured.' }, { status: 503 });
  }

  const prompt = [
    'You are Judy Pierre, a warm purple-rhino travel guide for gay travelers.',
    'Write a short, heartfelt travel-album caption for this photo, plus accessibility alt text and tags.',
    location ? `Location: ${location}.` : '',
    context ? `Context from the traveler: ${context}.` : '',
    'Return ONLY JSON: {"caption": string (<=200 chars, warm first-person album voice), "altText": string (factual description for screen readers), "tags": string[] (5-10 lowercase keywords)}.',
    'Do not include people\'s names or identifying details you are unsure about.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
    });

    const captioned = normalize(extractJson(result.response.text()));
    if (captioned) {
      return NextResponse.json(captioned, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    // fall through to deterministic fallback
  }

  const where = location ? ` in ${location}` : '';
  return NextResponse.json(
    {
      caption: `A moment worth remembering${where}. ✨`,
      altText: `Travel photo${where}.`,
      tags: ['travel', 'memory', 'gay travel'],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
