import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all trips (or by userId)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  try {
    const trips = await prisma.trip.findMany({
      where: userId ? { userId } : undefined,
      include: {
        itineraryItems: { orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }] },
        budgetItems: true,
        documents: true,
      },
      orderBy: { departureDate: 'asc' },
    });
    return NextResponse.json(trips);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create a new trip
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId, name, departureDate, returnDate,
      destinationName, destinationZip, destinationState, destinationCountry,
      destinationLat, destinationLng,
      originName, originZip, originState, originCountry,
      totalBudget, airfareCost, hotelCost, notes,
    } = body;

    // Auto-create a default user if none exists
    let finalUserId = userId;
    if (!finalUserId) {
      let defaultUser = await prisma.user.findFirst();
      if (!defaultUser) {
        defaultUser = await prisma.user.create({
          data: { name: 'Judy User', email: 'judy@example.com' },
        });
      }
      finalUserId = defaultUser.id;
    }

    const spendingBudget = (totalBudget || 0) - (airfareCost || 0) - (hotelCost || 0);

    const trip = await prisma.trip.create({
      data: {
        userId: finalUserId,
        name: name || 'My Trip',
        departureDate: new Date(departureDate),
        returnDate: new Date(returnDate),
        destinationName,
        destinationZip: destinationZip || null,
        destinationState: destinationState || null,
        destinationCountry: destinationCountry || 'US',
        destinationLat: destinationLat ? parseFloat(destinationLat) : null,
        destinationLng: destinationLng ? parseFloat(destinationLng) : null,
        originName: originName || null,
        originZip: originZip || null,
        originState: originState || null,
        originCountry: originCountry || null,
        totalBudget: totalBudget || 0,
        airfareCost: airfareCost || 0,
        hotelCost: hotelCost || 0,
        spendingBudget: spendingBudget > 0 ? spendingBudget : 0,
        notes: notes || null,
      },
      include: { itineraryItems: true, budgetItems: true, documents: true },
    });

    // Auto-generate budget allocation
    if (spendingBudget > 0) {
      const allocations = [
        { category: 'dining', label: 'Dining & Food', pct: 0.30 },
        { category: 'activities', label: 'Activities & Tours', pct: 0.25 },
        { category: 'transport', label: 'Local Transport', pct: 0.15 },
        { category: 'shopping', label: 'Shopping & Souvenirs', pct: 0.10 },
        { category: 'nightlife', label: 'Nightlife & Entertainment', pct: 0.10 },
        { category: 'misc', label: 'Miscellaneous', pct: 0.10 },
      ];

      for (const alloc of allocations) {
        await prisma.budgetItem.create({
          data: {
            tripId: trip.id,
            category: alloc.category,
            label: alloc.label,
            amount: Math.round(spendingBudget * alloc.pct * 100) / 100,
          },
        });
      }
    }

    // Re-fetch with budget items
    const fullTrip = await prisma.trip.findUnique({
      where: { id: trip.id },
      include: { itineraryItems: true, budgetItems: true, documents: true },
    });

    return NextResponse.json(fullTrip, { status: 201 });
  } catch (error: any) {
    console.error('Trip create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
