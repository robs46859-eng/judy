import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { configuredGeminiTextModel, createGeminiClient } from '@/lib/gemini/config';

export const runtime = 'nodejs';

/**
 * GET /api/alerts?destination=Marrakech%2C+Morocco
 * Travel alerts for gay travelers: a couple of universal safety reminders plus,
 * when available, AI-generated destination-specific guidance. Framed as
 * guidance to verify against official sources — never presented as legal fact.
 */

type Severity = 'info' | 'caution' | 'warning';

interface Alert {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  category: string;
}

const UNIVERSAL: Alert[] = [
  {
    id: 'know-local-laws',
    severity: 'info',
    title: 'Check local LGBTQ+ laws before you go',
    body: 'Legal protections and attitudes vary a lot by country and region. Confirm the current situation from an official source before booking.',
    category: 'safety',
  },
  {
    id: 'share-itinerary',
    severity: 'info',
    title: 'Share your plans with someone you trust',
    body: 'Send your itinerary and accommodation details to a friend, and check in regularly — especially for solo trips.',
    category: 'safety',
  },
];

const SEVERITIES: Severity[] = ['info', 'caution', 'warning'];

function coerceSeverity(value: unknown): Severity {
  return typeof value === 'string' && (SEVERITIES as string[]).includes(value)
    ? (value as Severity)
    : 'info';
}

function extractJsonArray(text: string | null): unknown[] | null {
  if (!text) return null;
  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  const first = candidate.indexOf('[');
  const last = candidate.lastIndexOf(']');
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    const parsed = JSON.parse(candidate.slice(first, last + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function aiAlerts(destination: string): Promise<Alert[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const prompt = [
    `You are a careful gay-travel safety advisor. For the destination "${destination}", give 2 to 4 concise, current, practical alerts a gay traveler should know (safety, local attitudes, neighborhoods, scams, events).`,
    'Return ONLY a JSON array; each item: {"severity": "info"|"caution"|"warning", "title": string (<=60 chars), "body": string (<=200 chars), "category": string}.',
    'Be factual and non-alarmist. Do not state specific laws as certainties — frame legal/safety items as guidance to verify.',
  ].join('\n');
  try {
    const genAI = createGeminiClient(key);
    const result = await genAI.models.generateContent({
      model: configuredGeminiTextModel(),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const arr = extractJsonArray(result.text ?? null);
    if (!arr) return [];
    return arr.slice(0, 4).flatMap((raw, i): Alert[] => {
      if (!raw || typeof raw !== 'object') return [];
      const o = raw as Record<string, unknown>;
      if (typeof o.title !== 'string' || typeof o.body !== 'string') return [];
      return [
        {
          id: `ai-${i}`,
          severity: coerceSeverity(o.severity),
          title: o.title.trim().slice(0, 80),
          body: o.body.trim().slice(0, 240),
          category: typeof o.category === 'string' ? o.category : 'guidance',
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const limited = enforceRateLimit(request, 'alerts', { limit: 30, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  const destination = request.nextUrl.searchParams.get('destination')?.trim() || '';

  const alerts = destination ? [...(await aiAlerts(destination)), ...UNIVERSAL] : UNIVERSAL;

  return NextResponse.json(
    { destination: destination || null, alerts },
    { headers: { 'Cache-Control': 'private, max-age=600' } }
  );
}
