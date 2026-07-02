import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/places/autocomplete?input=...
 * Uses Google Places Autocomplete to suggest locations
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'places-auto', { limit: 60, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  if (!input || input.length > 200) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  try {
    // Use Places API (New) - Autocomplete
    const url = `https://places.googleapis.com/v1/places:autocomplete`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ['locality', 'administrative_area_level_1', 'country', 'postal_code'],
        languageCode: 'en',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Places autocomplete error:', errText);
      return NextResponse.json({ predictions: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Places API error:', error);
    return NextResponse.json({ predictions: [], error: error.message }, { status: 500 });
  }
}
