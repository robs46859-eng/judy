import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const SCRIBE_TOKEN_URL =
  'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe';

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(
    request,
    'avatar-transcription-token',
    { limit: 10, windowMs: 60 * 1000 },
    userId
  );
  if (limited) return limited;

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice transcription is not configured' },
      { status: 501 }
    );
  }

  try {
    const upstream = await fetch(SCRIBE_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'xi-api-key': apiKey,
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return NextResponse.json(
          { error: 'Voice transcription is temporarily busy' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Could not start voice transcription' },
        { status: 502 }
      );
    }

    const payload = (await upstream.json()) as { token?: unknown };
    if (typeof payload.token !== 'string' || !payload.token.trim()) {
      return NextResponse.json(
        { error: 'Could not start voice transcription' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { token: payload.token },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Could not start voice transcription' },
      { status: 502 }
    );
  }
}
