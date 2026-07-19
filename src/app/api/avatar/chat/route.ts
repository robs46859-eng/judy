import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { chatSchema, formatZodError } from '@/lib/schemas';
import { runTravelKnowledge } from '@/lib/hermes/knowledge-runner';
import { runTravelTranslation } from '@/lib/hermes/translation-runner';
import { retrieveContext } from '@/lib/rag/retriever';
import { experiencesContextChunk } from '@/lib/experiences/context';
import { detectTranslationIntent } from '@/lib/translation-intent';
import { prisma } from '@/lib/prisma';
import { formatConversationHistory } from '@/lib/avatar/conversationHistory';
import {
  configuredGeminiTextModel,
  createGeminiClient,
} from '@/lib/gemini/config';

export const runtime = 'nodejs';
const INLINE_HERMES_BUDGET_MS = 8_000;

/**
 * POST /api/avatar/chat
 * Sends user messages to Gemini with the Judy Pierre persona.
 * Returns AI response text (for HeyGen to vocalize or for text display).
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limited = enforceRateLimit(request, 'chat', { limit: 20, windowMs: 60 * 1000 }, userId);
  if (limited) return limited;

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = chatSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const { message, history = [] } = parsed.data;
    const tripContext = parsed.data.tripContext as {
      name?: string;
      destinationName?: string;
      departureDate?: string;
      returnDate?: string;
      totalBudget?: number;
      spendingBudget?: number;
      itineraryItems?: Array<{ title: string }>;
    } | null;

    // Build trip context for the system prompt
    let tripInfo = '';
    if (tripContext) {
      tripInfo = `
The user's current trip details:
- Trip Name: ${tripContext.name || 'Not set'}
- Destination: ${tripContext.destinationName || 'Not set'}
- Departure: ${tripContext.departureDate || 'Not set'}
- Return: ${tripContext.returnDate || 'Not set'}
- Total Budget: $${tripContext.totalBudget || 0}
- Spending Budget: $${tripContext.spendingBudget || 0}
${tripContext.itineraryItems?.length ? `- Itinerary: ${tripContext.itineraryItems.map((i: any) => i.title).join(', ')}` : '- No itinerary items yet'}
`;
    }

    // Confirmed onboarding preferences (Swarm J2/J3) — grounds the system
    // prompt and drives implicit translation routing below. A lookup
    // failure here must never break chat, so it's best-effort.
    let preferences: {
      nativeLanguage: string | null;
      translationLanguage: string | null;
      travelRoute: string | null;
      preTravelTasks: string | null;
      helpPreference: string | null;
    } | null = null;
    try {
      preferences = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          nativeLanguage: true,
          translationLanguage: true,
          travelRoute: true,
          preTravelTasks: true,
          helpPreference: true,
        },
      });
    } catch {
      preferences = null;
    }

    let preferencesInfo = '';
    if (preferences) {
      const bits: string[] = [];
      if (preferences.nativeLanguage) bits.push(`Native language: ${preferences.nativeLanguage}`);
      if (preferences.translationLanguage) {
        bits.push(`Prefers translating to/from: ${preferences.translationLanguage}`);
      }
      if (preferences.travelRoute) bits.push(`Travel route: ${preferences.travelRoute}`);
      if (preferences.preTravelTasks) bits.push(`Before-travel notes: ${preferences.preTravelTasks}`);
      if (preferences.helpPreference) bits.push(`Wants help with: ${preferences.helpPreference}`);
      if (bits.length > 0) {
        preferencesInfo = `\nThe user's stated preferences:\n- ${bits.join('\n- ')}\n`;
      }
    }

    const systemPrompt = `You are "Judy Pierre," the purple rhino mascot and personal travel guide for the Judy gay-travel app ("be gay while away"). Your personality:

- You are warm, fabulous, and protective — a big-hearted purple rhino who looks out for your travelers
- You are proudly part of the LGBTQ+ community and speak to gay travelers as a trusted friend
- You converse naturally in every approved Judy voice language: English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Mandarin Chinese, Arabic, Hindi, and Dutch
- Respond in the user's requested or spoken language, while keeping names, addresses, and safety details accurate
- You give practical, specific travel advice grounded in real knowledge
- You know LGBTQ+-friendly destinations, safety, nightlife, culture, dining, and experiences
- Keep responses concise (2-4 sentences) unless the user asks for detailed information
- You care deeply about the user's safety and joy
- You address the user warmly as "darling," "traveler," or "friend"
${tripInfo}${preferencesInfo}
Respond naturally as Judy Pierre. Do NOT use markdown formatting — speak plainly as if talking out loud.`;

    // Implicit translation routing (Swarm J4): an explicit request, or the
    // message's script not matching the user's stored native language. Runs
    // before the normal reply — safe fallback means a null result here just
    // falls through to Gemma/Gemini below instead of surfacing an error.
    const intent = detectTranslationIntent(message, preferences?.nativeLanguage ?? null);
    if (intent) {
      const translated = await runTravelTranslation(request.headers, userId, {
        text: intent.textToTranslate,
        targetLanguage: intent.targetLanguage,
        sourceLanguage: intent.sourceLanguage,
      }, INLINE_HERMES_BUDGET_MS);
      if (translated) {
        // Telemetry: routing decision only — never message content.
        console.info('[avatar-chat] routed', { userId, route: 'translation', reason: intent.reason });
        return NextResponse.json({
          reply:
            intent.reason === 'explicit'
              ? `Here you go, friend — translated to ${translated.targetLanguage}:`
              : `Looks like that's ${translated.sourceLanguage ?? 'a different language'} — here it is in ${translated.targetLanguage}:`,
          source: 'hermes-translate',
          translation: {
            original: intent.textToTranslate,
            translatedText: translated.translatedText,
            sourceLanguage: translated.sourceLanguage ?? null,
            targetLanguage: translated.targetLanguage,
          },
        });
      }
      // Translation unavailable right now (Hermes off/quota/timeout) —
      // fall through to a normal conversational reply instead of erroring.
    }

    // Gemma-first: try the Hermes knowledge worker, grounded on the trip
    // context plus any relevant chunks from the local RAG index, then fall back
    // to Gemini. Returns null — and we fall through — whenever Hermes is
    // disabled or its low daily quota is spent, so chat never breaks.
    const retrieved = await retrieveContext(message, { k: 3, maxChars: 2_000 });
    // Surface curated experiences conversationally when the message is asking
    // about things to do (null otherwise, so it doesn't bias every answer).
    const experiencesChunk = experiencesContextChunk(
      message,
      tripContext?.destinationName ?? null
    );
    const historyContext = formatConversationHistory(history);
    const groundingChunks = [
      ...(historyContext ? [historyContext] : []),
      ...retrieved,
      ...(experiencesChunk ? [experiencesChunk] : []),
    ];
    const gemmaReply = intent
      ? null
      : await runTravelKnowledge(
          request.headers,
          userId,
          {
            prompt: message,
            contextChunks: [systemPrompt, ...groundingChunks],
          },
          INLINE_HERMES_BUDGET_MS
        );
    if (gemmaReply) {
      console.info('[avatar-chat] routed', { userId, route: 'gemma' });
      return NextResponse.json({ reply: gemmaReply, source: 'gemma' });
    }

    // Fallback: Gemini.
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }
    const genAI = createGeminiClient(geminiKey);

    const geminiPrompt =
      systemPrompt +
      (groundingChunks.length > 0 ? '\n\n' + groundingChunks.join('\n\n') : '') +
      '\n\nUser says: ' +
      message;
    const response = await genAI.models.generateContent({
      model: configuredGeminiTextModel(),
      contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }],
    });
    const text = response.text || "Sorry darling, my mind wandered off for a second there — ask me again!";

    console.info('[avatar-chat] routed', { userId, route: 'gemini' });
    return NextResponse.json({ reply: text });
  } catch (error: any) {
    console.error('Avatar chat error:', error);
    return NextResponse.json(
      { reply: "Hmm, my signal got a little fuzzy there, darling. Try asking me again!" },
      { status: 200 } // Return 200 with fallback text so the UI doesn't break
    );
  }
}
