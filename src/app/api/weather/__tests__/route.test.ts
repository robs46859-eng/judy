import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET } from '../route';

function weatherRequest(departureDate?: string) {
  const url = new URL('http://localhost/api/weather');
  url.searchParams.set('lat', '39.7392');
  url.searchParams.set('lng', '-104.9903');
  if (departureDate) url.searchParams.set('departureDate', departureDate);
  return new Request(url) as NextRequest;
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUserId.mockResolvedValue('user-a');
  mocks.enforceRateLimit.mockReturnValue(null);
  process.env.GOOGLE_MAPS_API_KEY = 'test-weather-key';
});

describe('GET /api/weather', () => {
  it('calls current conditions and forecast using Google Weather GET query parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ temperature: { degrees: 72 } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ forecastDays: [] })));
    const departureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const response = await GET(weatherRequest(departureDate));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [currentUrl, currentOptions] = fetchMock.mock.calls[0];
    const current = new URL(String(currentUrl));
    expect(current.origin + current.pathname).toBe(
      'https://weather.googleapis.com/v1/currentConditions:lookup'
    );
    expect(current.searchParams.get('key')).toBe('test-weather-key');
    expect(current.searchParams.get('location.latitude')).toBe('39.7392');
    expect(current.searchParams.get('location.longitude')).toBe('-104.9903');
    expect(current.searchParams.get('unitsSystem')).toBe('IMPERIAL');
    expect(currentOptions).toEqual({ method: 'GET' });

    const [forecastUrl, forecastOptions] = fetchMock.mock.calls[1];
    const forecast = new URL(String(forecastUrl));
    expect(forecast.origin + forecast.pathname).toBe(
      'https://weather.googleapis.com/v1/forecast/days:lookup'
    );
    expect(forecast.searchParams.get('key')).toBe('test-weather-key');
    expect(forecast.searchParams.get('location.latitude')).toBe('39.7392');
    expect(forecast.searchParams.get('location.longitude')).toBe('-104.9903');
    expect(forecast.searchParams.get('days')).toBe('10');
    expect(forecast.searchParams.get('unitsSystem')).toBe('IMPERIAL');
    expect(forecastOptions).toEqual({ method: 'GET' });
  });
});
