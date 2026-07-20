/**
 * RAG ingestion CLI.
 *
 *   npx tsx src/lib/rag/ingest.ts
 *
 * Reads every file under data/rag/sources/ (.md, .txt, .json), chunks the text,
 * embeds each chunk with Gemini (gemini-embedding-2), and writes the index to
 * data/rag/index/. Without GEMINI_API_KEY it still writes chunks (keyword-only
 * retrieval); with a key it writes embeddings too (cosine retrieval).
 *
 * .json sources must be an array of { id?, text, metadata? }.
 *
 * (No `server-only` import — this runs under tsx/node, not in a request.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { embedTexts, embeddingsAvailable } from './embeddings';
import { saveIndex, type RagChunk } from './store';

const SOURCES_DIR = path.resolve(process.cwd(), 'data/rag/sources');
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= CHUNK_SIZE) return clean.length > 0 ? [clean] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    const slice = clean.slice(start, end).trim();
    if (slice.length > 40) chunks.push(slice);
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

interface SourceDoc {
  baseId: string;
  text: string;
  source: string;
  metadata?: RagChunk['metadata'];
}

function readSources(): SourceDoc[] {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.error(`[RAG] No sources dir at ${SOURCES_DIR}`);
    return [];
  }

  const docs: SourceDoc[] = [];
  for (const name of fs.readdirSync(SOURCES_DIR)) {
    const full = path.join(SOURCES_DIR, name);
    if (!fs.statSync(full).isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    const base = path.basename(name, ext);

    if (ext === '.md' || ext === '.txt') {
      docs.push({ baseId: base, text: fs.readFileSync(full, 'utf-8'), source: name });
    } else if (ext === '.json') {
      try {
        const entries = JSON.parse(fs.readFileSync(full, 'utf-8'));
        if (Array.isArray(entries)) {
          entries.forEach((entry, i) => {
            if (entry && typeof entry.text === 'string' && entry.text.trim()) {
              docs.push({
                baseId: String(entry.id ?? `${base}-${i}`),
                text: entry.text,
                source: name,
                metadata: entry.metadata,
              });
            }
          });
        }
      } catch {
        console.warn(`[RAG] Skipping invalid JSON source: ${name}`);
      }
    }
  }
  return docs;
}

async function main() {
  console.log('=== Judy RAG ingestion ===');
  const docs = readSources();
  if (docs.length === 0) {
    console.error('[RAG] No sources found. Add files under data/rag/sources/.');
    process.exit(1);
  }

  const chunks: RagChunk[] = [];
  for (const doc of docs) {
    const pieces = chunkText(doc.text);
    pieces.forEach((text, i) => {
      chunks.push({
        id: `${doc.baseId}#${i}`,
        text,
        source: doc.source,
        metadata: doc.metadata,
      });
    });
  }
  console.log(`[RAG] ${docs.length} sources → ${chunks.length} chunks`);

  const vectors = new Map<string, number[]>();
  if (embeddingsAvailable()) {
    console.log('[RAG] Embedding with gemini-embedding-2…');
    const batchSize = 50;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embedded = await embedTexts(batch.map((c) => c.text));
      if (!embedded) {
        console.warn('[RAG] Embedding failed for a batch — continuing (keyword fallback).');
        continue;
      }
      batch.forEach((chunk, j) => vectors.set(chunk.id, embedded[j]));
      console.log(`[RAG] Embedded ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
    }
  } else {
    console.warn('[RAG] No GEMINI_API_KEY — writing chunks only (keyword retrieval).');
  }

  saveIndex(chunks, vectors);
  console.log(`[RAG] ✅ Index written: ${chunks.length} chunks, ${vectors.size} embeddings.`);
}

main().catch((err) => {
  console.error('[RAG] Ingestion failed:', err);
  process.exit(1);
});
