import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { suggestionsSchema, formatZodError } from '@/lib/schemas';

/**
 * POST /api/suggestions
 * Uses Gemini to suggest activities, restaurants, entertainment, etc. for a destination
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'suggestions', { limit: 10, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = suggestionsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const { destination, category, dates, preferences } = parsed.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured in .env' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const categoryDescriptions: Record<string, string> = {
      food: 'restaurants, cafes, food tours, street food, and local cuisine',
      activities: 'outdoor activities, adventure sports, tours, and sightseeing',
      entertainment: 'local theater, live shows, concerts, museums, and cultural events',
      nightlife: 'bars, clubs, lounges, live music venues, and night markets',
      relaxation: 'spas, wellness centers, beaches, parks, and relaxation spots',
      transport: 'local transportation options, rideshare, public transit, bike rentals',
      rentals: 'privately owned vacation rental options',
    };

    const categoryDesc = (category && categoryDescriptions[category]) || category || 'popular activities';
    const dateInfo = dates ? `Travel dates: ${dates}.` : '';
    const prefInfo = preferences ? `User preferences: ${preferences}.` : '';

    let prompt = `You are a friendly, knowledgeable travel advisor. Provide 5-8 specific, real suggestions for ${categoryDesc} in ${destination}. ${dateInfo} ${prefInfo}

For each suggestion, provide:
- Name of the place or activity
- Brief description (1-2 sentences)
- Estimated cost range (if applicable)
- Address or area

Format as a JSON array with objects containing: name, description, costRange, location.`;

    // Special handling for rentals - direct to specific sites
    if (category === 'rentals') {
      prompt = `You are a friendly travel advisor. The user is looking for privately owned vacation rentals in ${destination}. ${dateInfo}

Provide a brief paragraph about renting in this area, then provide exactly these 3 rental platforms with their search URLs for this destination:

1. VRBO - https://www.vrbo.com
2. Airbnb - https://www.airbnb.com
3. misterb&b - https://www.misterbnb.com

Format as JSON: { "overview": "...", "platforms": [{ "name": "...", "url": "...", "description": "..." }] }`;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text() || '';

    // Try to extract JSON from the response
    let extracted = null;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonObjMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { extracted = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    if (!extracted && jsonObjMatch) {
      try { extracted = JSON.parse(jsonObjMatch[0]); } catch { /* fall through */ }
    }

    return NextResponse.json({
      suggestions: extracted,
      rawText: text,
      category,
      destination,
    });
  } catch (error: any) {
    console.error('Suggestions API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
