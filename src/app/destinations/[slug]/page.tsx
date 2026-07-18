import { notFound } from 'next/navigation';
import { DESTINATIONS, DESTINATION_SLUGS } from '@/lib/seo/destinations';
import fs from 'node:fs';
import path from 'node:path';

export async function generateStaticParams() {
  return DESTINATION_SLUGS.map((slug) => ({ slug }));
}

function getPrecomputedSeo(slug: string) {
  try {
    const precomputedPath = path.resolve(process.cwd(), 'src/lib/seo/precomputed.json');
    const raw = fs.readFileSync(precomputedPath, 'utf-8');
    const data = JSON.parse(raw);
    return data[slug];
  } catch (err) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destination = DESTINATIONS[slug];
  if (!destination) return {};

  const seo = getPrecomputedSeo(slug);
  if (!seo) {
    return {
      title: `Gay Travel Guide to ${destination}`,
      description: `Plan your gay trip to ${destination}.`,
    };
  }

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords.join(', '),
  };
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destination = DESTINATIONS[slug];
  if (!destination) notFound();

  const seo = getPrecomputedSeo(slug);

  const h1 = seo?.h1 || `Gay Travel Guide to ${destination}`;
  const intro = seo?.intro || `Plan your gay trip to ${destination}.`;
  const jsonLd = seo?.jsonLd || {};

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-20 text-neutral-900 selection:bg-rose-200">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 font-serif text-5xl tracking-tight text-neutral-950 md:text-6xl">
          {h1}
        </h1>
        <p className="text-xl leading-relaxed text-neutral-700">
          {intro}
        </p>

        {/* JSON-LD injection */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </div>
    </main>
  );
}
