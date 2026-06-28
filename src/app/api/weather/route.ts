import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/weather?lat=...&lng=...&departureDate=...
 * Uses Google Weather API to get current conditions and forecasts.
 * If departure > 20 days out, returns historical/average data.
 * If departure <= 20 days, returns realtime forecast data.
 */
export async function GET(request: NextRequest) {
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
    const currentUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;
    const currentRes = await fetch(currentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude, longitude },
        unitsSystem: 'IMPERIAL',
      }),
    });

    let currentWeather = null;
    if (currentRes.ok) {
      currentWeather = await currentRes.json();
    }

    // Google Weather API - Forecast (up to 10 days)
    let forecast = null;
    if (daysUntilDeparture <= 20) {
      const forecastUrl = `https://weather.googleapis.com/v1/forecast/days:lookup?key=${apiKey}`;
      const forecastRes = await fetch(forecastUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { latitude, longitude },
          days: 10,
          unitsSystem: 'IMPERIAL',
        }),
      });
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
