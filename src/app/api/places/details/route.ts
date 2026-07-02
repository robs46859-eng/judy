import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/places/details?placeId=...
 * Get full details for a place (address components, lat/lng)
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'places-details', { limit: 30, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');

  if (!placeId) {
    return NextResponse.json({ error: 'placeId required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents,shortFormattedAddress',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Place details error:', errText);
      return NextResponse.json({ error: 'Failed to get place details' }, { status: 500 });
    }

    const data = await res.json();

    // Extract structured address info
    const components = data.addressComponents || [];
    let zip = '';
    let state = '';
    let country = '';

    for (const comp of components) {
      const types = comp.types || [];
      if (types.includes('postal_code')) zip = comp.longText || comp.shortText || '';
      if (types.includes('administrative_area_level_1')) state = comp.longText || comp.shortText || '';
      if (types.includes('country')) country = comp.longText || comp.shortText || '';
    }

    return NextResponse.json({
      placeId: data.id,
      name: data.displayName?.text || '',
      address: data.formattedAddress || data.shortFormattedAddress || '',
      lat: data.location?.latitude,
      lng: data.location?.longitude,
      zip,
      state,
      country,
    });
  } catch (error: any) {
    console.error('Place details error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
