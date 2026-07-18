/**
 * Curated gay-tailored experience catalog.
 *
 * Static content (no DB, no migration) so the avatar can recommend experiences
 * immediately. Filterable by destination and category. Extend this list — or
 * later back it with a DB table for user-saved/booked experiences — without
 * changing the API or UI contract.
 */

export type ExperienceCategory =
  | 'tour'
  | 'tickets'
  | 'dining'
  | 'hike'
  | 'cruise'
  | 'event'
  | 'nightlife'
  | 'excursion';

export const EXPERIENCE_CATEGORIES: ExperienceCategory[] = [
  'tour',
  'tickets',
  'dining',
  'hike',
  'cruise',
  'event',
  'nightlife',
  'excursion',
];

export interface Experience {
  id: string;
  title: string;
  category: ExperienceCategory;
  description: string;
  /** City this is anchored to (omit for destination-agnostic experiences). */
  city?: string;
  country?: string;
  priceFrom?: number;
  currency?: string;
  durationHours?: number;
  tags: string[];
  /** Whether it applies anywhere (cruises, generic guided experiences). */
  global?: boolean;
}

export const EXPERIENCES: Experience[] = [
  // ── Sitges, Spain ───────────────────────────────────────────
  {
    id: 'sitges-gay-beach-day',
    title: 'Sitges Gay Beach & Old Town Day',
    category: 'excursion',
    description:
      'Guided day around Sitges: the gay beaches (Playa de la Bassa Rodona), tapas in the old town, and sunset drinks along Calle del Pecado.',
    city: 'Sitges',
    country: 'Spain',
    priceFrom: 65,
    currency: 'EUR',
    durationHours: 6,
    tags: ['beach', 'walking', 'lgbtq', 'food'],
  },
  {
    id: 'sitges-pride-nightlife',
    title: 'Sitges Nightlife Crawl',
    category: 'nightlife',
    description:
      'Hosted crawl through Sitges’ famous gay bars and clubs — from cozy cocktail spots to late-night dancing.',
    city: 'Sitges',
    country: 'Spain',
    priceFrom: 40,
    currency: 'EUR',
    durationHours: 4,
    tags: ['nightlife', 'lgbtq', 'social'],
  },

  // ── Mykonos, Greece ─────────────────────────────────────────
  {
    id: 'mykonos-catamaran',
    title: 'Mykonos Gay Catamaran Cruise',
    category: 'cruise',
    description:
      'Half-day catamaran along the Mykonos coast with swim stops, drinks, and a welcoming LGBTQ+ crowd. Super Paradise beach optional.',
    city: 'Mykonos',
    country: 'Greece',
    priceFrom: 120,
    currency: 'EUR',
    durationHours: 5,
    tags: ['cruise', 'beach', 'lgbtq', 'swim'],
  },
  {
    id: 'mykonos-jackie-o',
    title: 'Jackie O’ Beach Club Entry',
    category: 'tickets',
    description:
      'Daytime access to the iconic Jackie O’ beach club — sunbeds, cocktails, drag shows, and the best gay scene on Super Paradise.',
    city: 'Mykonos',
    country: 'Greece',
    priceFrom: 50,
    currency: 'EUR',
    tags: ['beach club', 'nightlife', 'lgbtq', 'drag'],
  },

  // ── Puerto Vallarta, Mexico ─────────────────────────────────
  {
    id: 'pv-zona-romantica-food',
    title: 'Zona Romántica Gay Food Tour',
    category: 'dining',
    description:
      'Taste your way through Puerto Vallarta’s gay district — street tacos, mezcal, and a rooftop finish overlooking Los Muertos beach.',
    city: 'Puerto Vallarta',
    country: 'Mexico',
    priceFrom: 55,
    currency: 'USD',
    durationHours: 3,
    tags: ['food', 'lgbtq', 'walking'],
  },
  {
    id: 'pv-sunset-cruise',
    title: 'Puerto Vallarta Gay Sunset Cruise',
    category: 'cruise',
    description:
      'Adults-only sunset sail on Banderas Bay with an open bar, music, and a friendly gay crowd.',
    city: 'Puerto Vallarta',
    country: 'Mexico',
    priceFrom: 75,
    currency: 'USD',
    durationHours: 3,
    tags: ['cruise', 'lgbtq', 'sunset'],
  },

  // ── Madrid, Spain ───────────────────────────────────────────
  {
    id: 'madrid-chueca-walk',
    title: 'Chueca LGBTQ+ History Walking Tour',
    category: 'tour',
    description:
      'Walk through Madrid’s Chueca district with a local guide — the history of Spanish gay liberation, landmark bars, and MADO Pride lore.',
    city: 'Madrid',
    country: 'Spain',
    priceFrom: 30,
    currency: 'EUR',
    durationHours: 2,
    tags: ['walking', 'history', 'lgbtq'],
  },

  // ── Berlin, Germany ─────────────────────────────────────────
  {
    id: 'berlin-queer-history',
    title: 'Queer Berlin History Tour',
    category: 'tour',
    description:
      'From Weimar cabaret to the Schöneberg gay village and the Memorial to Homosexuals — Berlin’s deep LGBTQ+ history with an expert guide.',
    city: 'Berlin',
    country: 'Germany',
    priceFrom: 25,
    currency: 'EUR',
    durationHours: 3,
    tags: ['walking', 'history', 'lgbtq'],
  },
  {
    id: 'berlin-club-night',
    title: 'Berlin Gay Club Night Guide',
    category: 'nightlife',
    description:
      'A host who knows the door policies takes you through Berlin’s legendary gay/queer clubs — no wasted nights or missed lines.',
    city: 'Berlin',
    country: 'Germany',
    priceFrom: 60,
    currency: 'EUR',
    durationHours: 5,
    tags: ['nightlife', 'lgbtq', 'techno'],
  },

  // ── Bangkok, Thailand ───────────────────────────────────────
  {
    id: 'bangkok-silom-nightlife',
    title: 'Silom Soi 4 Gay Nightlife Tour',
    category: 'nightlife',
    description:
      'Guided evening through Bangkok’s gay heart — Silom Soi 2 & 4 clubs, rooftop bars, and a cabaret show.',
    city: 'Bangkok',
    country: 'Thailand',
    priceFrom: 45,
    currency: 'USD',
    durationHours: 4,
    tags: ['nightlife', 'lgbtq', 'cabaret'],
  },

  // ── Destination-agnostic / global ───────────────────────────
  {
    id: 'global-gay-group-cruise',
    title: 'All-Gay Group Cruise Getaway',
    category: 'cruise',
    description:
      'Multi-day all-gay cruise itineraries (Atlantis-style) with parties, shows, and shore excursions. Great for solo travelers wanting instant community.',
    priceFrom: 899,
    currency: 'USD',
    tags: ['cruise', 'lgbtq', 'group', 'solo-friendly'],
    global: true,
  },
  {
    id: 'global-scenic-hike',
    title: 'LGBTQ+ Friendly Guided Day Hike',
    category: 'hike',
    description:
      'A welcoming small-group day hike with a vetted guide — nature, views, and easygoing company wherever your trip takes you.',
    priceFrom: 45,
    currency: 'USD',
    durationHours: 5,
    tags: ['hike', 'nature', 'lgbtq', 'solo-friendly'],
    global: true,
  },
  {
    id: 'global-pride-tickets',
    title: 'Local Pride & Circuit Event Tickets',
    category: 'event',
    description:
      'Hook into the biggest Pride weeks and circuit parties at your destination — passes, timing tips, and what to book early.',
    tags: ['event', 'pride', 'lgbtq', 'nightlife'],
    global: true,
  },
];

export interface ExperienceFilter {
  destination?: string | null;
  category?: ExperienceCategory | null;
  limit?: number;
}

/** Case-insensitive match of a city/country against a free-text destination. */
function matchesDestination(exp: Experience, destination: string): boolean {
  if (exp.global) return true;
  const d = destination.toLowerCase();
  return Boolean(
    (exp.city && d.includes(exp.city.toLowerCase())) ||
      (exp.country && d.includes(exp.country.toLowerCase()))
  );
}

/**
 * Filter the catalog. With a destination, returns destination matches first
 * (then global fillers); without one, returns everything. Category narrows it.
 */
export function filterExperiences(filter: ExperienceFilter = {}): Experience[] {
  const { destination, category, limit } = filter;

  let list = EXPERIENCES;
  if (category) list = list.filter((e) => e.category === category);

  if (destination && destination.trim()) {
    const dest = destination.trim();
    const local = list.filter((e) => !e.global && matchesDestination(e, dest));
    const global = list.filter((e) => e.global);
    // Local matches first, then a few global options as fallback/inspiration.
    list = [...local, ...global];
  }

  return typeof limit === 'number' ? list.slice(0, limit) : list;
}
