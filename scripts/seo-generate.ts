import fs from 'node:fs';
import path from 'node:path';
import { DESTINATIONS } from '../src/lib/seo/destinations';
import { generateDestinationSeo } from '../src/lib/seo/generate';

const PRECOMPUTED_PATH = path.resolve(process.cwd(), 'src/lib/seo/precomputed.json');

async function main() {
  console.log('=== Precomputing SEO Metadata ===');
  const results: Record<string, any> = {};

  const headers = new Headers();
  const userId = 'admin-cli';

  for (const [slug, destination] of Object.entries(DESTINATIONS)) {
    console.log(`Generating SEO for: ${destination} (${slug})...`);
    try {
      const seoResult = await generateDestinationSeo(headers, userId, { destination });
      results[slug] = seoResult;
      console.log(`  -> Generated (Source: ${seoResult.source})`);
    } catch (err) {
      console.error(`  -> Failed for ${destination}:`, err);
    }
  }

  fs.mkdirSync(path.dirname(PRECOMPUTED_PATH), { recursive: true });
  fs.writeFileSync(PRECOMPUTED_PATH, JSON.stringify(results, null, 2));
  console.log(`=== Done. Wrote ${Object.keys(results).length} entries to ${PRECOMPUTED_PATH} ===`);
}

main().catch(err => {
  console.error('Failed SEO generation:', err);
  process.exit(1);
});
