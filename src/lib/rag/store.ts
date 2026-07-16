import fs from 'node:fs';
import path from 'node:path';

/**
 * On-disk RAG index (JSON, no external vector DB — mirrors the local pattern
 * used in the PawsMemories app). Two files under data/rag/index/:
 *   chunks.json      — [{ id, text, source, metadata }]
 *   embeddings.json  — [{ id, vector: number[] }]
 * The loaded index is cached in-process; `saveIndex` invalidates the cache.
 *
 * (No `server-only` so the ingest CLI can import it under tsx/node.)
 */

export interface RagChunk {
  id: string;
  text: string;
  source: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface LoadedIndex {
  chunks: RagChunk[];
  vectors: Map<string, number[]>;
}

export const RAG_INDEX_DIR = path.resolve(process.cwd(), 'data/rag/index');
const CHUNKS_FILE = path.join(RAG_INDEX_DIR, 'chunks.json');
const EMBEDDINGS_FILE = path.join(RAG_INDEX_DIR, 'embeddings.json');

let cache: LoadedIndex | null = null;

export function loadIndex(): LoadedIndex {
  if (cache) return cache;

  if (!fs.existsSync(CHUNKS_FILE)) {
    cache = { chunks: [], vectors: new Map() };
    return cache;
  }

  let chunks: RagChunk[] = [];
  const vectors = new Map<string, number[]>();
  try {
    chunks = JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf-8')) as RagChunk[];
    if (fs.existsSync(EMBEDDINGS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8')) as Array<{
        id: string;
        vector: number[];
      }>;
      for (const row of raw) {
        if (row?.id && Array.isArray(row.vector)) vectors.set(row.id, row.vector);
      }
    }
  } catch {
    // Corrupt index → behave as empty rather than throwing at request time.
    cache = { chunks: [], vectors: new Map() };
    return cache;
  }

  cache = { chunks, vectors };
  return cache;
}

export function saveIndex(chunks: RagChunk[], vectors: Map<string, number[]>): void {
  fs.mkdirSync(RAG_INDEX_DIR, { recursive: true });
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(chunks, null, 2));
  fs.writeFileSync(
    EMBEDDINGS_FILE,
    JSON.stringify([...vectors].map(([id, vector]) => ({ id, vector })))
  );
  cache = null; // force reload on next request
}
