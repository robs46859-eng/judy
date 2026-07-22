import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { saveMemoryImage } from '@/lib/memories/storage';
import { runTravelTranslation } from '@/lib/hermes/translation-runner';
import { validateBase64Image } from '@/lib/images/base64';

export const runtime = 'nodejs';

const MAX_BASE64_CHARS = 14 * 1024 * 1024; // ~10 MB image
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const createSchema = z
  .object({
    imageBase64: z.string().min(16).max(MAX_BASE64_CHARS),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    caption: z.string().trim().min(1).max(400),
    altText: z.string().trim().max(300).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    location: z.string().trim().max(160).optional(),
    tripId: z.string().trim().max(64).optional(),
  })
  .strict();

interface MemoryDTO {
  id: string;
  imageUrl: string;
  caption: string;
  altText: string | null;
  tags: string[];
  location: string | null;
  translatedCaption: string | null;
  translationLanguage: string | null;
  sourceLanguage: string | null;
  createdAt: string;
}

function toDTO(m: {
  id: string;
  imageUrl: string;
  caption: string;
  altText: string | null;
  tags: string | null;
  location: string | null;
  translatedCaption: string | null;
  translationLanguage: string | null;
  sourceLanguage: string | null;
  createdAt: Date;
}): MemoryDTO {
  return {
    id: m.id,
    imageUrl: m.imageUrl,
    caption: m.caption,
    altText: m.altText,
    tags: m.tags ? m.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    location: m.location,
    translatedCaption: m.translatedCaption,
    translationLanguage: m.translationLanguage,
    sourceLanguage: m.sourceLanguage,
    createdAt: m.createdAt.toISOString(),
  };
}

/** GET /api/memories?tripId=... — list the signed-in user's memories, newest first. */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const tripId = request.nextUrl.searchParams.get('tripId')?.trim() || undefined;
  const memories = await prisma.memory.findMany({
    where: { userId, ...(tripId ? { tripId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(
    { memories: memories.map(toDTO) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/** POST /api/memories — save a photo + caption; auto-translates the caption. */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const limited = enforceRateLimit(request, 'memories-create', { limit: 30, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid memory request.' }, { status: 400 });
  }
  const { imageBase64, mimeType, caption, altText, tags, location, tripId } = parsed.data;
  const validatedImage = validateBase64Image(imageBase64, mimeType, {
    maxBytes: MAX_IMAGE_BYTES,
  });
  if (!validatedImage) {
    return NextResponse.json({ error: 'The uploaded image data is invalid.' }, { status: 400 });
  }

  // 1) Persist the image to disk.
  let imageUrl: string;
  try {
    imageUrl = await saveMemoryImage(userId, validatedImage.data, validatedImage.mimeType);
  } catch {
    return NextResponse.json({ error: 'Could not store the image.' }, { status: 400 });
  }

  // 2) Auto-translate the caption into the user's preferred language (best effort).
  let translatedCaption: string | null = null;
  let translationLanguage: string | null = null;
  let sourceLanguage: string | null = null;
  try {
    const prefs = await prisma.user.findUnique({
      where: { id: userId },
      select: { translationLanguage: true, nativeLanguage: true },
    });
    const target = prefs?.translationLanguage?.trim();
    if (target) {
      const translated = await runTravelTranslation(request.headers, userId, {
        text: caption,
        targetLanguage: target,
        sourceLanguage: prefs?.nativeLanguage?.trim() || undefined,
      });
      if (translated) {
        translatedCaption = translated.translatedText;
        translationLanguage = translated.targetLanguage;
        sourceLanguage = translated.sourceLanguage ?? prefs?.nativeLanguage?.trim() ?? null;
      }
    }
  } catch {
    // Translation is a bonus — never block saving a memory.
  }

  // 3) Persist the record.
  const memory = await prisma.memory.create({
    data: {
      userId,
      tripId: tripId || null,
      imageUrl,
      caption,
      altText: altText || null,
      tags: tags && tags.length > 0 ? tags.join(',') : null,
      location: location || null,
      translatedCaption,
      translationLanguage,
      sourceLanguage,
    },
  });

  return NextResponse.json(toDTO(memory), {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}
