import Link from 'next/link';
import { DESTINATIONS } from '@/lib/seo/destinations';

export const metadata = {
  title: 'Top Gay Travel Destinations - Judy',
  description: 'Explore our curated list of top gay travel destinations worldwide.',
};

export default function DestinationsIndex() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-20 text-neutral-900 selection:bg-rose-200">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 font-serif text-5xl tracking-tight text-neutral-950">
          Gay Travel Destinations
        </h1>
        <p className="mb-10 text-xl leading-relaxed text-neutral-700">
          Explore our curated selection of top LGBTQ+-friendly travel destinations. 
          Discover history, nightlife, and culture across the globe.
        </p>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(DESTINATIONS).map(([slug, name]) => (
            <li key={slug}>
              <Link
                href={`/destinations/${slug}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-rose-300 hover:bg-rose-50"
              >
                <span className="font-medium text-neutral-900">{name}</span>
                <span className="mt-1 block text-sm text-neutral-500">
                  Read gay travel guide &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
