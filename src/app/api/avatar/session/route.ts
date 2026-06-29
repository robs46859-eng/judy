import { NextResponse } from 'next/server';

/**
 * POST /api/avatar/session
 * Creates a HeyGen Interactive Avatar streaming session.
 * Returns session credentials for the frontend to connect.
 */
export async function POST() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'HEYGEN_API_KEY not configured' }, { status: 500 });
  }

  try {
    // Create a new interactive avatar session via HeyGen API
    const res = await fetch('https://api.heygen.com/v1/interactive_avatars', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        quality: 'medium',
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('HeyGen session error:', res.status, errBody);
      return NextResponse.json(
        { error: 'Failed to create HeyGen session', details: errBody },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('HeyGen session creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
