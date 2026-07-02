import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { tripCreateSchema, formatZodError } from '@/lib/schemas';

// GET all trips for the signed-in user
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const trips = await prisma.trip.findMany({
      where: { userId },
      include: {
        itineraryItems: { orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }] },
        budgetItems: true,
        documents: true,
      },
      orderBy: { departureDate: 'asc' },
    });
    return NextResponse.json(trips);
  } catch (error) {
    console.error('Trips fetch error:', error);
    return NextResponse.json({ error: 'Could not load trips.' }, { status: 500 });
  }
}

// POST create a new trip for the signed-in user
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = tripCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const data = parsed.data;
  const totalBudget = data.totalBudget ?? 0;
  const airfareCost = data.airfareCost ?? 0;
  const hotelCost = data.hotelCost ?? 0;
  const spendingBudget = totalBudget - airfareCost - hotelCost;

  try {
    const trip = await prisma.trip.create({
      data: {
        userId,
        name: data.name || 'My Trip',
        departureDate: data.departureDate,
        returnDate: data.returnDate,
        destinationName: data.destinationName,
        destinationZip: data.destinationZip || null,
        destinationState: data.destinationState || null,
        destinationCountry: data.destinationCountry || 'US',
        destinationLat: data.destinationLat ?? null,
        destinationLng: data.destinationLng ?? null,
        originName: data.originName || null,
        originZip: data.originZip || null,
        originState: data.originState || null,
        originCountry: data.originCountry || null,
        totalBudget,
        airfareCost,
        hotelCost,
        spendingBudget: spendingBudget > 0 ? spendingBudget : 0,
        notes: data.notes || null,
      },
    });

    // Auto-generate budget allocation
    if (spendingBudget > 0) {
      const allocations = [
        { category: 'dining', label: 'Dining & Food', pct: 0.3 },
        { category: 'activities', label: 'Activities & Tours', pct: 0.25 },
        { category: 'transport', label: 'Local Transport', pct: 0.15 },
        { category: 'shopping', label: 'Shopping & Souvenirs', pct: 0.1 },
        { category: 'nightlife', label: 'Nightlife & Entertainment', pct: 0.1 },
        { category: 'misc', label: 'Miscellaneous', pct: 0.1 },
      ];

      await prisma.budgetItem.createMany({
        data: allocations.map((alloc) => ({
          tripId: trip.id,
          category: alloc.category,
          label: alloc.label,
          amount: Math.round(spendingBudget * alloc.pct * 100) / 100,
        })),
      });
    }

    const fullTrip = await prisma.trip.findUnique({
      where: { id: trip.id },
      include: { itineraryItems: true, budgetItems: true, documents: true },
    });

    return NextResponse.json(fullTrip, { status: 201 });
  } catch (error) {
    console.error('Trip create error:', error);
    return NextResponse.json({ error: 'Could not create trip.' }, { status: 500 });
  }
}
