import fs from 'node:fs';
import path from 'node:path';

const SOURCES_DIR = path.resolve(process.cwd(), 'data/rag/sources');

// Configuration
// RAG_FEEDS_URLS="https://example.com/api/feed1,https://example.com/api/feed2"
const ALLOWLIST = (process.env.RAG_FEEDS_ALLOWLIST || 'example.com').split(',').map(s => s.trim());
const FEEDS = (process.env.RAG_FEEDS_URLS || '').split(',').map(s => s.trim()).filter(Boolean);

interface SourceDoc {
  id: string;
  text: string;
  metadata?: any;
}

function isAllowed(urlString: string) {
  try {
    const url = new URL(urlString);
    return ALLOWLIST.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function fetchFeed(url: string): Promise<SourceDoc[]> {
  if (!isAllowed(url)) {
    console.warn(`[Feeds] URL not in allowlist: ${url}`);
    return [];
  }
  
  try {
    console.log(`[Feeds] Fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    // Normalize into SourceDoc array
    const docs: SourceDoc[] = [];
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.text) {
          docs.push({
            id: item.id ? String(item.id) : `feed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            text: String(item.text),
            metadata: item.metadata || { source: url }
          });
        }
      }
    }
    return docs;
  } catch (err) {
    console.error(`[Feeds] Failed to fetch ${url}:`, err);
    return [];
  }
}

async function main() {
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
  }

  if (FEEDS.length === 0) {
    console.log('[Feeds] No feeds configured in RAG_FEEDS_URLS. Exiting.');
    return;
  }

  for (const feedUrl of FEEDS) {
    const docs = await fetchFeed(feedUrl);
    if (docs.length === 0) continue;

    try {
      const urlHost = new URL(feedUrl).hostname.replace(/[^a-z0-9]/gi, '-');
      const outPath = path.join(SOURCES_DIR, `feed-${urlHost}.json`);
      
      let existingDocs: SourceDoc[] = [];
      if (fs.existsSync(outPath)) {
        try {
          existingDocs = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        } catch {
          // ignore invalid json
        }
      }

      // Deduplicate by ID
      const mergedMap = new Map<string, SourceDoc>();
      for (const doc of existingDocs) mergedMap.set(doc.id, doc);
      for (const doc of docs) mergedMap.set(doc.id, doc);

      const mergedDocs = Array.from(mergedMap.values());
      fs.writeFileSync(outPath, JSON.stringify(mergedDocs, null, 2));
      console.log(`[Feeds] Saved ${mergedDocs.length} items (${docs.length} from this run) to feed-${urlHost}.json`);
    } catch (err) {
      console.error(`[Feeds] Failed processing feed ${feedUrl}:`, err);
    }
  }
}

main().catch(err => {
  console.error('[Feeds] Error:', err);
  process.exit(1);
});
