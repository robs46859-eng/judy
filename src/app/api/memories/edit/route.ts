import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { presetById } from '@/lib/memories/edit-presets';

export const runtime = 'nodejs';

/**
 * POST /api/memories/edit
 * AI-edits a photo with Gemini's image model (nano-banana) and returns the
 * edited image. A preset id or a free-text prompt drives the edit. If the model
 * or the key lacks image-generation access, responds 503 with a clear message —
 * never a silently-unedited image.
 *
 * The model can be overridden with GEMINI_IMAGE_MODEL.
 */

const MAX_BASE64_CHARS = 8 * 1024 * 1024;
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';

const bodySchema = z
  .object({
    imageBase64: z.string().min(16).max(MAX_BASE64_CHARS),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    preset: z.string().trim().max(40).optional(),
    prompt: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.preset || v.prompt), {
    message: 'A preset or prompt is required.',
  });

interface InlineDataPart {
  inlineData?: { mimeType?: string; data?: string };
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const limited = enforceRateLimit(request, 'memories-edit', { limit: 10, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid edit request.' }, { status: 400 });
  }
  const { imageBase64, mimeType, preset, prompt } = parsed.data;

  const instruction =
    (preset ? presetById(preset)?.prompt : undefined) ||
    prompt ||
    presetById('portra')!.prompt;

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'AI photo editing is not configured.' }, { status: 503 });
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });
    // Ask the model to return an image. `responseModalities` isn't in the older
    // SDK's request typings, so the whole request is cast to the expected type.
    const genRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: instruction }, { inlineData: { mimeType, data: imageBase64 } }],
        },
      ],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    };
    const result = await model.generateContent(
      genRequest as unknown as Parameters<typeof model.generateContent>[0]
    );

    const parts = (result.response.candidates?.[0]?.content?.parts ?? []) as InlineDataPart[];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (imagePart?.inlineData?.data) {
      return NextResponse.json(
        {
          imageBase64: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType ?? 'image/png',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } catch {
    // fall through to the 503 below
  }

  return NextResponse.json(
    { error: 'The image model did not return an edited image. Your API key may not have image-generation access.' },
    { status: 503 }
  );
}
