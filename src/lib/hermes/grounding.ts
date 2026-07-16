/**
 * Data-grounding for Gemma.
 *
 * Two jobs live here:
 *
 *  1. Per-request grounding — turn a user's trip into compact context chunks
 *     that ride along with a `knowledge` job so Gemma answers about THIS trip.
 *     Knowledge input is byte-budgeted (prompt + chunks ≤ 8 KB), so these are
 *     deliberately terse.
 *
 *  2. Ingestion export — format app data + external datasets/feeds into
 *     retrieval documents for the worker's `judy-travel` collection, emitted as
 *     JSONL. The exact ingestion endpoint is owned by the VPS worker; this
 *     produces a stable, documented shape ({ id, text, metadata, collection })
 *     you can pipe into whatever ingestion the worker exposes.
 *
 * No network here — pure formatting, so it is trivially testable.
 */

export const JUDY_COLLECTION = 'judy-travel';

// Keep per-request grounding well under the knowledge 8 KB budget so the
// user's prompt always has room.
const MAX_CONTEXT_CHUNK_CHARS = 1_200;
const MAX_CONTEXT_TOTAL_CHARS = 3_500;

export interface GroundingTrip {
  name?: string | null;
  destinationName?: string | null;
  destinationCountry?: string | null;
  destinationState?: string | null;
  departureDate?: string | Date | null;
  returnDate?: string | Date | null;
  totalBudget?: number | null;
  spendingBudget?: number | null;
  notes?: string | null;
  itineraryItems?: Array<{
    title?: string | null;
    category?: string | null;
    date?: string | Date | null;
    location?: string | null;
    cost?: number | null;
  }> | null;
}

function asDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : null;
  return date.toISOString().slice(0, 10);
}

function clamp(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Compact context chunks describing a trip, for per-request knowledge grounding.
 * Returns [] when there's nothing useful to say (caller can skip grounding).
 */
export function tripToContextChunks(trip: GroundingTrip | null | undefined): string[] {
  if (!trip) return [];

  const chunks: string[] = [];

  const destination = [trip.destinationName, trip.destinationState, trip.destinationCountry]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');

  const overviewParts: string[] = [];
  if (trip.name) overviewParts.push(`Trip: ${trip.name}.`);
  if (destination) overviewParts.push(`Destination: ${destination}.`);
  const depart = asDateString(trip.departureDate);
  const ret = asDateString(trip.returnDate);
  if (depart || ret) overviewParts.push(`Dates: ${depart ?? '?'} to ${ret ?? '?'}.`);
  if (typeof trip.totalBudget === 'number' && trip.totalBudget > 0) {
    overviewParts.push(`Total budget: $${trip.totalBudget}.`);
  }
  if (typeof trip.spendingBudget === 'number' && trip.spendingBudget > 0) {
    overviewParts.push(`Spending budget: $${trip.spendingBudget}.`);
  }
  if (trip.notes) overviewParts.push(`Notes: ${trip.notes}`);
  if (overviewParts.length > 0) {
    chunks.push(clamp(overviewParts.join(' '), MAX_CONTEXT_CHUNK_CHARS));
  }

  const items = (trip.itineraryItems ?? []).filter((item) => item && item.title);
  if (items.length > 0) {
    const lines = items.slice(0, 40).map((item) => {
      const bits = [item.title!.trim()];
      if (item.category) bits.push(`(${item.category})`);
      const day = asDateString(item.date);
      if (day) bits.push(`on ${day}`);
      if (item.location) bits.push(`at ${item.location}`);
      if (typeof item.cost === 'number' && item.cost > 0) bits.push(`~$${item.cost}`);
      return bits.join(' ');
    });
    chunks.push(clamp(`Planned itinerary: ${lines.join('; ')}.`, MAX_CONTEXT_CHUNK_CHARS));
  }

  // Enforce the total budget by dropping from the end if needed.
  const bounded: string[] = [];
  let total = 0;
  for (const chunk of chunks) {
    if (total + chunk.length > MAX_CONTEXT_TOTAL_CHARS) break;
    bounded.push(chunk);
    total += chunk.length;
  }
  return bounded;
}

/** A retrieval document for the judy-travel collection. */
export interface IngestionDocument {
  id: string;
  text: string;
  collection: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface DatasetRecordInput {
  id: string;
  /** Main body indexed for retrieval. */
  text: string;
  /** Optional flat metadata (source, region, url, tags, ...). */
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const MAX_INGESTION_TEXT_CHARS = 8_000;

function cleanMetadata(
  metadata: DatasetRecordInput['metadata']
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!metadata) return out;
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    out[key] = typeof value === 'string' ? clamp(value, 500) : value;
  }
  return out;
}

/**
 * Map raw dataset/feed records into ingestion documents for `judy-travel`.
 * Records with an empty id or body are skipped.
 */
export function datasetToIngestionDocuments(
  records: readonly DatasetRecordInput[],
  collection: string = JUDY_COLLECTION
): IngestionDocument[] {
  const docs: IngestionDocument[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const id = record.id?.trim();
    const text = record.text?.trim();
    if (!id || !text || seen.has(id)) continue;
    seen.add(id);

    docs.push({
      id,
      text: clamp(text, MAX_INGESTION_TEXT_CHARS),
      collection,
      metadata: cleanMetadata(record.metadata),
    });
  }

  return docs;
}

/** Serialize ingestion documents as newline-delimited JSON (one doc per line). */
export function toJsonl(documents: readonly IngestionDocument[]): string {
  return documents.map((doc) => JSON.stringify(doc)).join('\n');
}
