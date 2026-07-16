import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { avatarLipsyncSchema, formatZodError } from '@/lib/schemas';
import { synthesizeSpeech, TtsNotConfiguredError } from '@/lib/avatar/tts';
import { runRhubarb, RhubarbUnavailableError } from '@/lib/avatar/rhubarb';

export const runtime = 'nodejs';

/**
 * POST /api/avatar/lipsync
 * Swarm J7, stage 2: synthesizes speech audio for the given text, then runs
 * Rhubarb Lip Sync against it to get an accurate mouth-cue timeline for the
 * rigged GLB avatar. Both steps are optional infrastructure — this always
 * degrades gracefully rather than erroring:
 *   - No TTS provider configured  -> 501, client stays on stage-1 (browser
 *     speechSynthesis + approximate jaw movement).
 *   - TTS succeeds but Rhubarb fails/unavailable -> 200 with real audio and
 *     empty cues, client still gets real speech, just without precise sync.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'avatar-lipsync', { limit: 20, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = avatarLipsyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  let speech;
  try {
    speech = await synthesizeSpeech({
      text: parsed.data.text,
      language: parsed.data.language ?? 'en-US',
    });
  } catch (error) {
    if (error instanceof TtsNotConfiguredError) {
      return NextResponse.json({ error: 'Speech synthesis is not configured' }, { status: 501 });
    }
    console.error('[avatar-lipsync] TTS error:', error);
    return NextResponse.json({ error: 'Speech synthesis failed' }, { status: 502 });
  }

  const audioBase64 = speech.audio.toString('base64');

  // Rhubarb needs a real file on disk — write to a private per-request temp
  // dir and always clean it up, success or failure.
  let tempDir: string | null = null;
  try {
    tempDir = await mkdtemp(join(tmpdir(), 'judy-lipsync-'));
    const wavPath = join(tempDir, `${randomUUID()}.wav`);
    await writeFile(wavPath, speech.audio);

    const cues = await runRhubarb(wavPath);
    return NextResponse.json({ audio: audioBase64, mimeType: speech.mimeType, cues });
  } catch (error) {
    if (error instanceof RhubarbUnavailableError) {
      console.warn('[avatar-lipsync] Rhubarb unavailable, returning audio without cues:', error.message);
      return NextResponse.json({ audio: audioBase64, mimeType: speech.mimeType, cues: [] });
    }
    console.error('[avatar-lipsync] unexpected error:', error);
    return NextResponse.json({ audio: audioBase64, mimeType: speech.mimeType, cues: [] });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
