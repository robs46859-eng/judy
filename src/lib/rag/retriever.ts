import 'server-only';

import { embedQuery, embeddingsAvailable } from './embeddings';
import { loadIndex, type RagChunk } from './store';

/**
 * Request-time retrieval over the local RAG index.
 *
 * Prefers embedding cosine-similarity; falls back to keyword overlap when no
 * embeddings/API key are available. Returns plain strings ready to drop into a
 * knowledge job's `context_chunks`, budgeted by total characters so the 8 KB
 * knowledge input cap isn't blown.
 */

export interface RetrieveOptions {
  k?: number;
  /** Total character budget across returned chunks. */
  maxChars?: number;
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function keywordScore(queryTokens: Set<string>, text: string): number {
  if (queryTokens.size === 0) return 0;
  const textTokens = tokenize(text);
  let hits = 0;
  for (const token of textTokens) if (queryTokens.has(token)) hits++;
  return hits / Math.sqrt(textTokens.length || 1);
}

function budget(chunks: RagChunk[], maxChars: number): string[] {
  const out: string[] = [];
  let total = 0;
  for (const chunk of chunks) {
    const text = chunk.text.trim();
    if (!text) continue;
    if (total + text.length > maxChars) continue;
    out.push(text);
    total += text.length;
  }
  return out;
}

export async function retrieveContext(
  query: string,
  options: RetrieveOptions = {}
): Promise<string[]> {
  const k = options.k ?? 4;
  const maxChars = options.maxChars ?? 2_500;

  const { chunks, vectors } = loadIndex();
  if (chunks.length === 0 || !query.trim()) return [];

  // Embedding path.
  if (embeddingsAvailable() && vectors.size > 0) {
    const queryVector = await embedQuery(query);
    if (queryVector) {
      const scored = chunks
        .map((chunk) => {
          const vector = vectors.get(chunk.id);
          return vector ? { chunk, score: cosine(queryVector, vector) } : null;
        })
        .filter((entry): entry is { chunk: RagChunk; score: number } => entry !== null)
        .sort((a, b) => b.score - a.score);

      const top = scored.slice(0, k).map((entry) => entry.chunk);
      if (top.length > 0) return budget(top, maxChars);
    }
  }

  // Keyword fallback.
  const queryTokens = new Set(tokenize(query));
  const scored = chunks
    .map((chunk) => ({ chunk, score: keywordScore(queryTokens, chunk.text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((entry) => entry.chunk);

  return budget(scored, maxChars);
}
