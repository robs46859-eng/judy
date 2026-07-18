import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import {
  EXPERIENCE_CATEGORIES,
  filterExperiences,
  type ExperienceCategory,
} from '@/lib/experiences/catalog';

export const runtime = 'nodejs';

/**
 * GET /api/experiences?destination=Sitges%2C+Spain&category=nightlife&limit=10
 * Returns curated gay-tailored experiences, filtered by destination/category.
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const destination = params.get('destination');

  const categoryParam = params.get('category');
  const category =
    categoryParam && (EXPERIENCE_CATEGORIES as string[]).includes(categoryParam)
      ? (categoryParam as ExperienceCategory)
      : null;

  const limitParam = Number(params.get('limit'));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : undefined;

  const experiences = filterExperiences({ destination, category, limit });

  return NextResponse.json(
    { experiences },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  );
}
