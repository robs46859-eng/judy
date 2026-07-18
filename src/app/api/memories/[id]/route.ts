import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteMemoryImage } from '@/lib/memories/storage';

export const runtime = 'nodejs';

/** DELETE /api/memories/:id — remove a memory (and its image), owner-scoped. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { id } = await params;
  const memory = await prisma.memory.findFirst({ where: { id, userId } });
  if (!memory) return NextResponse.json({ error: 'Memory not found.' }, { status: 404 });

  await prisma.memory.delete({ where: { id: memory.id } });
  await deleteMemoryImage(memory.imageUrl);

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
