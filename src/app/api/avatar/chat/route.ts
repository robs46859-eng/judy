import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * POST /api/avatar/chat
 * Sends user messages to Gemini with the Travel Daddy persona.
 * Returns AI response text (for HeyGen to vocalize or for text display).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, tripContext } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
${tripInfo}
Respond naturally as Travel Daddy. Do NOT use markdown formatting — speak plainly as if talking out loud.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nUser says: ' + message }] },
      ],
    });

    const response = result.response;
    const text = response.text() || "HAH! Sorry traveler, my brain froze for a second there. Ask me again!";

    return NextResponse.json({ reply: text });
  } catch (error: any) {
    console.error('Avatar chat error:', error);
    return NextResponse.json(
      { reply: "Hmm, seems like the trail got a little rough there, friend. Try asking me again!" },
      { status: 200 } // Return 200 with fallback text so the UI doesn't break
    );
  }
}
