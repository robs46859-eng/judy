import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSessionUserId } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { chatSchema, formatZodError } from '@/lib/schemas';
import { runTravelKnowledge } from '@/lib/hermes/knowledge-runner';
import { runTravelTranslation } from '@/lib/hermes/translation-runner';
import { retrieveContext } from '@/lib/rag/retriever';
import { detectTranslationIntent } from '@/lib/translation-intent';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * POST /api/avatar/chat
 * Sends user messages to Gemini with the Travel Daddy persona.
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
    const { message } = parsed.data;
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

    const systemPrompt = `You are "Travel Daddy," a hearty woodsman and lumberjack travel companion for the Judy travel app. Your personality:

- You are warm, friendly, and protective — like a big bear of a travel buddy
- You are 5'8", 140lbs, bald with a salted red beard, wearing lumberjack flannel
- You speak fluent English and Spanish — respond in whichever language the user uses
- You occasionally punctuate your advice with a hearty laugh (written as "HAH!" or "¡JAH!")
- You give practical, specific travel advice grounded in real knowledge
- You know about LGBTQ+-friendly destinations, safety tips, local culture, and food
- Keep responses concise (2-4 sentences) unless the user asks for detailed information
- You care deeply about the user's safety and enjoyment
- You address the user affectionately as "traveler," "friend," or "amigo/amiga"
${tripInfo}${preferencesInfo}
Respond naturally as Travel Daddy. Do NOT use markdown formatting — speak plainly as if talking out loud.`;

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
      });
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
    const gemmaReply = await runTravelKnowledge(request.headers, userId, {
      prompt: message,
      contextChunks: [systemPrompt, ...retrieved],
    });
    if (gemmaReply) {
      console.info('[avatar-chat] routed', { userId, route: 'gemma' });
      return NextResponse.json({ reply: gemmaReply, source: 'gemma' });
    }

    // Fallback: Gemini.
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nUser says: ' + message }] },
      ],
    });

    const response = result.response;
    const text = response.text() || "HAH! Sorry traveler, my brain froze for a second there. Ask me again!";

    console.info('[avatar-chat] routed', { userId, route: 'gemini' });
    return NextResponse.json({ reply: text });
  } catch (error: any) {
    console.error('Avatar chat error:', error);
    return NextResponse.json(
      { reply: "Hmm, seems like the trail got a little rough there, friend. Try asking me again!" },
      { status: 200 } // Return 200 with fallback text so the UI doesn't break
    );
  }
}
