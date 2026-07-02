import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { avatarStopSchema, formatZodError } from '@/lib/schemas';

/**
 * POST /api/avatar/stop
 * Ends an active HeyGen avatar streaming session.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

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

  const parsed = avatarStopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  try {
    await fetch('https://api.heygen.com/v1/streaming.stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_id: parsed.data.sessionId }),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('HeyGen stop error:', error);
    return NextResponse.json({ error: 'Avatar stop error' }, { status: 500 });
  }
}
