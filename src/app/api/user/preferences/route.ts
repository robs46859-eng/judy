import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { userPreferencesPatchSchema, formatZodError } from '@/lib/schemas';

const SELECT = {
  nativeLanguage: true,
  translationLanguage: true,
  travelRoute: true,
  preTravelTasks: true,
  helpPreference: true,
  voiceId: true,
  spokenLanguage: true,
  onboardingCompletedAt: true,
} as const;

/**
 * GET /api/user/preferences
 * Returns the signed-in user's conversational-onboarding preferences.
 * Used by TravelDaddy to decide whether to run the intake flow or the
 * normal chat/translate experience.
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'user-preferences-get', { limit: 60, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: SELECT });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error('Preferences fetch error:', error);
    return NextResponse.json({ error: 'Could not load preferences.' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/preferences
 * Updates the signed-in user's own preferences — never another user's
 * (there is no userId in the body; ownership is the session, full stop).
 * Only ever writes whitelisted, zod-validated fields. `onboardingCompletedAt`
 * is set server-side from `completeOnboarding: true`, never from client input,
 * so nothing — including raw model output — can write an arbitrary value
 * straight to Prisma.
 */
export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'user-preferences-patch', { limit: 20, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = userPreferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { completeOnboarding, ...fields } = parsed.data;

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...fields,
        ...(completeOnboarding ? { onboardingCompletedAt: new Date() } : {}),
      },
      select: SELECT,
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error('Preferences update error:', error);
    return NextResponse.json({ error: 'Could not save preferences.' }, { status: 500 });
  }
}
