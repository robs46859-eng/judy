import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini embeddings for the local RAG index.
 *
 * Uses `gemini-embedding-001` via the SDK the app already depends on
 * (@google/generative-ai) — no new dependency. Tries the batch endpoint first
 * and falls back to per-item embedding if the batch shape isn't as expected.
 * Returns null on any failure so callers can degrade to keyword search.
 *
 * (No `server-only` here so the ingest CLI can import it under tsx/node.)
 */

export const RAG_EMBED_MODEL = 'gemini-embedding-001';

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function client(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key ? new GoogleGenerativeAI(key) : null;
}

/** Embed many texts. Returns one vector per input, or null on failure. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const genAI = client();
  if (!genAI || texts.length === 0) return null;
  const model = genAI.getGenerativeModel({ model: RAG_EMBED_MODEL });

  // Preferred: single batch call.
  try {
    const res = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
      })),
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
      const r = await model.embedContent(text);
      const values = r.embedding?.values;
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
