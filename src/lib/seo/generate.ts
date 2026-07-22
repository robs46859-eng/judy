import 'server-only';

import { configuredGeminiTextModel, createGeminiClient } from '@/lib/gemini/config';
import { z } from 'zod';
import { runTravelKnowledge } from '@/lib/hermes/knowledge-runner';
import { retrieveContext } from '@/lib/rag/retriever';

/**
 * SEO generation for gay-travel destination pages.
 *
 * Gemma-first: composes a structured prompt, runs it through the Hermes
 * `knowledge` worker (grounded on any context chunks passed in), and parses the
 * model's JSON. Falls back to Gemini when Hermes is disabled / out of quota, and
 * to a deterministic template if neither model returns usable JSON — so callers
 * always get a complete, valid SEO object.
 */

export interface SeoInput {
  /** e.g. "Lisbon, Portugal" */
  destination: string;
  /** Who the copy targets. Defaults to gay/LGBTQ+ travelers. */
  audience?: string;
  /** Optional extra grounding (feed snippets, trip context, ...). */
  contextChunks?: string[];
}

export interface SeoResult {
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  intro: string;
  jsonLd: Record<string, unknown>;
  source: 'gemma' | 'gemini' | 'fallback';
}

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;
const INTRO_MAX = 900;

const seoModelSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string().min(1)).default([]),
  h1: z.string().min(1).optional(),
  intro: z.string().min(1).optional(),
  jsonLd: z.record(z.string(), z.unknown()).optional(),
});

function clamp(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function buildPrompt(input: SeoInput): string {
  const audience = input.audience?.trim() || 'gay and LGBTQ+ travelers';
  return [
    `You are an SEO copywriter for a gay travel app called Judy ("be gay while away").`,
    `Write SEO metadata for a destination landing page about: ${input.destination}.`,
    `Target audience: ${audience}. Emphasize LGBTQ+-friendliness, safety, culture, nightlife, and things to do.`,
    ``,
    `Return ONLY a JSON object (no markdown, no commentary) with these keys:`,
    `- "title": string, <= ${TITLE_MAX} characters, compelling page title.`,
    `- "description": string, <= ${DESCRIPTION_MAX} characters, meta description.`,
    `- "keywords": array of 6-12 lowercase keyword strings.`,
    `- "h1": string, the page heading.`,
    `- "intro": string, 2-3 sentence landing-page intro paragraph.`,
    `- "jsonLd": a schema.org JSON-LD object of @type "TouristDestination" with name and description.`,
  ].join('\n');
}

function extractJsonObject(text: string | null): unknown | null {
  if (!text) return null;
  let candidate = text.trim();
  // Strip ```json ... ``` fences if present.
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  // Narrow to the outermost object.
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}

function fallbackJsonLd(destination: string, description: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: destination,
    description,
  };
}

function normalize(
  raw: unknown,
  input: SeoInput,
  source: 'gemma' | 'gemini'
): SeoResult | null {
  const parsed = seoModelSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;

  const title = clamp(data.title, TITLE_MAX);
  const description = clamp(data.description, DESCRIPTION_MAX);
  const keywords = Array.from(
    new Set(data.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))
  ).slice(0, 12);

  const jsonLd =
    data.jsonLd && typeof data.jsonLd === 'object'
      ? (data.jsonLd as Record<string, unknown>)
      : fallbackJsonLd(input.destination, description);

  return {
    title,
    description,
    keywords,
    h1: (data.h1 ?? input.destination).trim(),
    intro: clamp(data.intro ?? description, INTRO_MAX),
    jsonLd,
    source,
  };
}

function templateFallback(input: SeoInput): SeoResult {
  const destination = input.destination.trim();
  const description = clamp(
    `Plan your gay trip to ${destination}: LGBTQ+-friendly stays, nightlife, dining, and things to do with Judy.`,
    DESCRIPTION_MAX
  );
  return {
    title: clamp(`Gay ${destination} Travel Guide`, TITLE_MAX),
    description,
    keywords: [
      `gay ${destination.toLowerCase()}`,
      `lgbtq ${destination.toLowerCase()}`,
      'gay travel',
      'gay friendly',
      'gay nightlife',
      'queer travel',
    ],
    h1: `Gay Travel Guide to ${destination}`,
    intro: `Discover ${destination} through a gay lens — where to stay, where to play, and how to be gay while away. Judy helps you plan every detail.`,
    jsonLd: fallbackJsonLd(destination, description),
    source: 'fallback',
  };
}

async function askGeminiJson(prompt: string): Promise<unknown | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const genAI = createGeminiClient(key);
    const result = await genAI.models.generateContent({
      model: configuredGeminiTextModel(),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 1_200,
        temperature: 0.4,
      },
    });
    return extractJsonObject(result.text ?? null);
  } catch {
    return null;
  }
}

export async function generateDestinationSeo(
  headers: Headers,
  userId: string,
  input: SeoInput
): Promise<SeoResult> {
  const prompt = buildPrompt(input);

  // 1) Gemma (grounded) first — pull relevant chunks from the local RAG index
  //    and merge with any caller-supplied context.
  const retrieved = await retrieveContext(`${input.destination} gay travel`, {
    k: 3,
    maxChars: 2_000,
  });
  const contextChunks = [...(input.contextChunks ?? []), ...retrieved];
  if (contextChunks.length === 0) {
    contextChunks.push(`Destination SEO request for ${input.destination}.`);
  }

  const gemmaText = await runTravelKnowledge(headers, userId, { prompt, contextChunks });
  const fromGemma = normalize(extractJsonObject(gemmaText), input, 'gemma');
  if (fromGemma) return fromGemma;

  // 2) Gemini fallback.
  const fromGemini = normalize(await askGeminiJson(prompt), input, 'gemini');
  if (fromGemini) return fromGemini;

  // 3) Deterministic template — always valid.
  return templateFallback(input);
}
