import {
  filterExperiences,
  type ExperienceCategory,
} from './catalog';

/**
 * Turn a chat message into a compact "experiences you can recommend" context
 * chunk, so Judy Pierre can surface curated experiences conversationally (not
 * only via the panel). Returns null when the message isn't asking about things
 * to do — so we don't bias every answer with a list.
 */

const CATEGORY_KEYWORDS: Record<ExperienceCategory, string[]> = {
  tour: ['tour', 'guide', 'walking', 'sightsee'],
  tickets: ['ticket', 'entry', 'pass', 'admission'],
  dining: ['eat', 'food', 'dining', 'restaurant', 'dinner', 'lunch', 'brunch', 'tapas'],
  hike: ['hike', 'trail', 'trek', 'nature', 'walk'],
  cruise: ['cruise', 'boat', 'sail', 'catamaran', 'yacht'],
  event: ['event', 'pride', 'festival', 'circuit', 'party'],
  nightlife: ['nightlife', 'club', 'bar', 'drag', 'dance', 'tonight', 'night out'],
  excursion: ['excursion', 'day trip', 'beach', 'activity', 'adventure'],
};

const INTENT_KEYWORDS = [
  'experience', 'experiences', 'do', 'see', 'things to do', 'recommend',
  'recommendation', 'suggest', 'what should', "what's good", 'whats good',
  'where to', 'go out', 'visit', 'book', 'plan',
];

function detectCategory(query: string): ExperienceCategory | null {
  const q = query.toLowerCase();
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => q.includes(w))) return category as ExperienceCategory;
  }
  return null;
}

function looksLikeExperienceQuery(query: string): boolean {
  const q = query.toLowerCase();
  return INTENT_KEYWORDS.some((w) => q.includes(w)) || detectCategory(query) !== null;
}

export function experiencesContextChunk(
  query: string,
  destination?: string | null
): string | null {
  if (!looksLikeExperienceQuery(query)) return null;

  const category = detectCategory(query);
  const matches = filterExperiences({ destination, category, limit: 5 });
  if (matches.length === 0) return null;

  const lines = matches.map((e) => {
    const where = e.city ? `, ${e.city}` : '';
    const price =
      typeof e.priceFrom === 'number' ? ` — from ${e.currency ?? '$'}${e.priceFrom}` : '';
    return `- ${e.title} (${e.category}${where})${price}: ${e.description}`;
  });

  return `Curated gay-tailored experiences you can recommend to the traveler:\n${lines.join('\n')}`;
}
