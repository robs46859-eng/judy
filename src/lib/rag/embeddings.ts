import type { GoogleGenAI } from '@google/genai';
import { createGeminiClient, RAG_EMBED_MODEL } from '@/lib/gemini/config';

/**
 * Gemini embeddings for the local RAG index.
 *
 * Uses `gemini-embedding-2` via the SDK the app already depends on
 * through the maintained Google Gen AI SDK. Tries a batch request first and
 * falls back to per-item embedding if the batch shape isn't as expected.
 * Returns null on any failure so callers can degrade to keyword search.
 *
 * (No `server-only` here so the ingest CLI can import it under tsx/node.)
 */

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function client(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key ? createGeminiClient(key) : null;
}

/** Embed many texts. Returns one vector per input, or null on failure. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const genAI = client();
  if (!genAI || texts.length === 0) return null;
  // Preferred: single batch call.
  try {
    const res = await genAI.models.embedContent({
      model: RAG_EMBED_MODEL,
      contents: texts,
    });
    const vectors = res.embeddings?.map((e) => e.values);
    if (
      vectors &&
      vectors.length === texts.length &&
      vectors.every((v) => Array.isArray(v) && v.length > 0)
    ) {
      return vectors as number[][];
    }
  } catch {
    // fall through to per-item
  }

  // Fallback: one request per text.
  const out: number[][] = [];
  for (const text of texts) {
    try {
      const r = await genAI.models.embedContent({
        model: RAG_EMBED_MODEL,
        contents: text,
      });
      const values = r.embeddings?.[0]?.values;
      if (!Array.isArray(values) || values.length === 0) return null;
      out.push(values);
      // Gentle pacing to stay under free-tier rate limits during ingest.
      await new Promise((resolve) => setTimeout(resolve, 60));
    } catch {
      return null;
    }
  }
  return out;
}

/** Embed a single query string. Returns the vector or null. */
export async function embedQuery(text: string): Promise<number[] | null> {
  const vectors = await embedTexts([text]);
  return vectors ? vectors[0] : null;
}
