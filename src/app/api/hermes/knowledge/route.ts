import type { NextRequest } from 'next/server';
import { handleHermesCreate } from '@/lib/hermes/route-handlers';
import { hermesKnowledgeSchema } from '@/lib/hermes/schemas';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return handleHermesCreate(request, 'knowledge', hermesKnowledgeSchema);
}
