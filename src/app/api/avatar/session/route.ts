import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { getHeyGenVoiceEnvKey, selectVoiceForLanguage } from '@/lib/voice/catalog';

const HEYGEN_BASE = 'https://api.heygen.com/v1';

/**
 * POST /api/avatar/session
 * Creates and starts a HeyGen Interactive Avatar streaming session.
 * Returns LiveKit connection credentials for the client.
 * Responds 501 when HEYGEN_API_KEY is not configured so the client can
 * fall back to the local 3D placeholder without treating it as an error.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'avatar-session', { limit: 5, windowMs: 10 * 60 * 1000 }, userId);
  if (limited) return limited;

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Interactive avatar is not configured' }, { status: 501 });
  }

  try {
    // 1. Create a new streaming session. A selected logical voice may map to
    // a Hostinger HEYGEN_VOICE_<CATALOG_ID> variable; without one, the existing
    // account default remains untouched.
    const avatarId = process.env.HEYGEN_AVATAR_ID;
    let voiceId = process.env.HEYGEN_VOICE_ID;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { voiceId: true, spokenLanguage: true },
      });
      const selectedVoice = selectVoiceForLanguage(user?.voiceId, user?.spokenLanguage);
      voiceId = process.env[getHeyGenVoiceEnvKey(selectedVoice.id)] || voiceId;
    } catch {
      // The configured account default remains available if preferences cannot load.
    }

    const newRes = await fetch(`${HEYGEN_BASE}/streaming.new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        quality: 'medium',
        version: 'v2',
        video_encoding: 'H264',
        ...(avatarId ? { avatar_name: avatarId } : {}),
        ...(voiceId ? { voice: { voice_id: voiceId } } : {}),
      }),
    });

    if (!newRes.ok) {
      const errBody = await newRes.text();
      console.error('HeyGen streaming.new error:', newRes.status, errBody);
      return NextResponse.json({ error: 'Failed to create avatar session' }, { status: 502 });
    }

    const newData = await newRes.json();
    const sessionData = newData.data ?? newData;
    const sessionId = sessionData.session_id;
    const livekitUrl = sessionData.url;
    const accessToken = sessionData.access_token;

    if (!sessionId || !livekitUrl || !accessToken) {
      console.error('HeyGen streaming.new returned unexpected payload');
      return NextResponse.json({ error: 'Unexpected avatar session response' }, { status: 502 });
    }

    // 2. Start the session
    const startRes = await fetch(`${HEYGEN_BASE}/streaming.start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_id: sessionId }),
    });

    if (!startRes.ok) {
      const errBody = await startRes.text();
      console.error('HeyGen streaming.start error:', startRes.status, errBody);
      return NextResponse.json({ error: 'Failed to start avatar session' }, { status: 502 });
    }

    return NextResponse.json({ sessionId, url: livekitUrl, accessToken });
  } catch (error) {
    console.error('HeyGen session creation error:', error);
    return NextResponse.json({ error: 'Avatar session error' }, { status: 500 });
  }
}
