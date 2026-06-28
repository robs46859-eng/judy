import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST add itinerary item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tripId, date, time, title, description, category, location, address, lat, lng, cost } = body;

    if (!tripId || !title) {
      return NextResponse.json({ error: 'tripId and title are required' }, { status: 400 });
    }

    const item = await prisma.itineraryItem.create({
      data: {
        tripId,
        date: new Date(date || Date.now()),
        time: time || null,
        title,
        description: description || null,
        category: category || null,
        location: location || null,
        address: address || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        cost: cost ? parseFloat(cost) : null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE an itinerary item
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    await prisma.itineraryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
