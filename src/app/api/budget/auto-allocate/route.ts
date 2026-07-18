import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { autoAllocateBudget, costTierForDestination } from '@/lib/budget/auto-allocate';

export const runtime = 'nodejs';

/**
 * POST /api/budget/auto-allocate
 * Auto-allocates a trip's spending budget across categories.
 *
 * Give a tripId (preferred — pulls budget/dates/destination and can persist the
 * result as the trip's BudgetItems when persist=true), or pass explicit
 * spendingBudget/days/destinationCountry for a preview without a trip.
 */

const bodySchema = z
  .object({
    tripId: z.string().trim().max(64).optional(),
    spendingBudget: z.number().finite().min(0).max(10_000_000).optional(),
    days: z.number().int().min(1).max(365).optional(),
    destinationCountry: z.string().trim().max(120).optional(),
    persist: z.boolean().optional(),
  })
  .strict();

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const limited = enforceRateLimit(request, 'budget-allocate', { limit: 30, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid budget request.' }, { status: 400 });
  }
  const body = parsed.data;

  let spendingBudget = body.spendingBudget ?? 0;
  let days = body.days ?? 1;
  let destinationCountry = body.destinationCountry ?? null;
  let trip: { id: string } | null = null;

  if (body.tripId) {
    const found = await prisma.trip.findFirst({
      where: { id: body.tripId, userId },
      select: {
        id: true,
        spendingBudget: true,
        totalBudget: true,
        airfareCost: true,
        hotelCost: true,
        departureDate: true,
        returnDate: true,
        destinationCountry: true,
      },
    });
    if (!found) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    trip = { id: found.id };

    // Prefer an explicit spending budget; otherwise derive it from what's left
    // after airfare + hotel.
    spendingBudget =
      found.spendingBudget && found.spendingBudget > 0
        ? found.spendingBudget
        : Math.max(0, (found.totalBudget ?? 0) - (found.airfareCost ?? 0) - (found.hotelCost ?? 0));
    days = daysBetween(found.departureDate, found.returnDate);
    destinationCountry = found.destinationCountry ?? null;
  }

  const allocations = autoAllocateBudget({ spendingBudget, days, destinationCountry });
  const tier = costTierForDestination(destinationCountry);

  let persisted = false;
  if (body.persist && trip) {
    // Replace the trip's budget items with the fresh allocation.
    await prisma.$transaction([
      prisma.budgetItem.deleteMany({ where: { tripId: trip.id } }),
      prisma.budgetItem.createMany({
        data: allocations.map((a) => ({
          tripId: trip!.id,
          category: a.category,
          label: a.label,
          amount: a.amount,
        })),
      }),
    ]);
    persisted = true;
  }

  return NextResponse.json(
    { allocations, days, spendingBudget, tier, persisted },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
