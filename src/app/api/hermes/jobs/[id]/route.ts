import type { NextRequest } from 'next/server';
import { handleHermesStatus } from '@/lib/hermes/route-handlers';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleHermesStatus(request, id);
}
