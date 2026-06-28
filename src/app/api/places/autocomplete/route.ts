import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/places/autocomplete?input=...
 * Uses Google Places Autocomplete to suggest locations
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  if (!input) {
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
