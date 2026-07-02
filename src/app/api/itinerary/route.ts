import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { itineraryItemSchema, formatZodError } from '@/lib/schemas';

// POST add itinerary item (only to a trip owned by the signed-in user)
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

  const parsed = itineraryItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const data = parsed.data;

  try {
    // Ownership check: the trip must belong to the session user
    const trip = await prisma.trip.findUnique({
      where: { id: data.tripId },
      select: { userId: true },
    });
    if (!trip || trip.userId !== userId) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const item = await prisma.itineraryItem.create({
      data: {
        tripId: data.tripId,
        date: data.date ?? new Date(),
        time: data.time || null,
        title: data.title,
        description: data.description || null,
        category: data.category || null,
        location: data.location || null,
        address: data.address || null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        cost: data.cost ?? null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Itinerary create error:', error);
    return NextResponse.json({ error: 'Could not add itinerary item.' }, { status: 500 });
  }
}

// DELETE an itinerary item (only if its trip belongs to the signed-in user)
export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    // Ownership check before mutating
    const item = await prisma.itineraryItem.findUnique({
      where: { id },
      select: { trip: { select: { userId: true } } },
    });
    if (!item || item.trip.userId !== userId) {
      return NextResponse.json({ error: 'Itinerary item not found' }, { status: 404 });
    }

    await prisma.itineraryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Itinerary delete error:', error);
    return NextResponse.json({ error: 'Could not delete itinerary item.' }, { status: 500 });
  }
}
