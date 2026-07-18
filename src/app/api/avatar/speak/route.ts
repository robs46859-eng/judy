import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { avatarSpeakSchema, formatZodError } from '@/lib/schemas';
import { prepareSpeechForUser } from '@/lib/avatar/speech-preparation';

/**
 * POST /api/avatar/speak
 * Makes the active HeyGen avatar session speak the provided text.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'avatar-speak', { limit: 20, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Interactive avatar is not configured' }, { status: 501 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = avatarSpeakSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const prepared = await prepareSpeechForUser(request.headers, userId, {
    text: parsed.data.text,
    replyLanguage: parsed.data.language,
  });

  try {
    const res = await fetch('https://api.heygen.com/v1/streaming.task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        session_id: parsed.data.sessionId,
        text: prepared.text,
        task_type: 'repeat',
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('HeyGen streaming.task error:', res.status, errBody);
      return NextResponse.json({ error: 'Avatar speak failed' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      spokenText: prepared.text,
      spokenLanguage: prepared.language,
      voiceId: prepared.voiceId,
    });
  } catch (error) {
    console.error('HeyGen speak error:', error);
    return NextResponse.json({ error: 'Avatar speak error' }, { status: 500 });
  }
}
