import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/weather?lat=...&lng=...&departureDate=...
 * Uses Google Weather API to get current conditions and forecasts.
 * If departure > 20 days out, returns historical/average data.
 * If departure <= 20 days, returns realtime forecast data.
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'weather', { limit: 30, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const departureDateStr = searchParams.get('departureDate');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  try {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Calculate days until departure
    let daysUntilDeparture = Infinity;
    if (departureDateStr) {
      const departureDate = new Date(departureDateStr);
      const now = new Date();
      daysUntilDeparture = Math.ceil((departureDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Google Weather API - Current Conditions
    const currentUrl = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
    currentUrl.searchParams.set('key', apiKey);
    currentUrl.searchParams.set('location.latitude', String(latitude));
    currentUrl.searchParams.set('location.longitude', String(longitude));
    currentUrl.searchParams.set('unitsSystem', 'IMPERIAL');
    const currentRes = await fetch(currentUrl, { method: 'GET' });

    let currentWeather = null;
    if (currentRes.ok) {
      currentWeather = await currentRes.json();
    }

    // Google Weather API - Forecast (up to 10 days)
    let forecast = null;
    if (daysUntilDeparture <= 20) {
      const forecastUrl = new URL('https://weather.googleapis.com/v1/forecast/days:lookup');
      forecastUrl.searchParams.set('key', apiKey);
      forecastUrl.searchParams.set('location.latitude', String(latitude));
      forecastUrl.searchParams.set('location.longitude', String(longitude));
      forecastUrl.searchParams.set('days', '10');
      forecastUrl.searchParams.set('unitsSystem', 'IMPERIAL');
      const forecastRes = await fetch(forecastUrl, { method: 'GET' });
      if (forecastRes.ok) {
        forecast = await forecastRes.json();
      }
    }

    // For > 20 days out, provide historical averages
    let historicalNote = null;
    if (daysUntilDeparture > 20) {
      historicalNote = 'Departure is more than 20 days away. Showing historical averages for the destination. Real-time forecast will appear within 20 days of departure.';
    }

    return NextResponse.json({
      current: currentWeather,
      forecast,
      historicalNote,
      daysUntilDeparture: daysUntilDeparture === Infinity ? null : daysUntilDeparture,
    });
  } catch (error: any) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 });
  }
}
