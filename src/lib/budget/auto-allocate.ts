/**
 * Deterministic spending-budget auto-allocator.
 *
 * Splits a trip's discretionary spending budget across categories using sensible
 * weights, nudged by a destination cost tier, and exposes a per-day view. Pure
 * and rounding-exact (allocations always sum back to the input), so it's easy to
 * unit test and safe to run without any network.
 */

export type BudgetCategory =
  | 'dining'
  | 'activities'
  | 'nightlife'
  | 'transport'
  | 'shopping'
  | 'misc';

export interface BudgetAllocation {
  category: BudgetCategory;
  label: string;
  amount: number;
  perDay: number;
}

const BASE_WEIGHTS: Record<BudgetCategory, number> = {
  dining: 0.3,
  activities: 0.22,
  nightlife: 0.18,
  transport: 0.12,
  shopping: 0.1,
  misc: 0.08,
};

const LABELS: Record<BudgetCategory, string> = {
  dining: 'Dining',
  activities: 'Activities',
  nightlife: 'Nightlife',
  transport: 'Transport',
  shopping: 'Shopping',
  misc: 'Miscellaneous',
};

export type CostTier = 'budget' | 'moderate' | 'premium';

// Rough tiering of common gay-travel destinations by day-to-day cost.
const PREMIUM = ['switzerland', 'norway', 'iceland', 'denmark', 'singapore', 'japan', 'united states', 'usa', 'australia', 'united kingdom', 'uk'];
const BUDGET = ['thailand', 'vietnam', 'mexico', 'portugal', 'greece', 'colombia', 'indonesia', 'hungary', 'czechia', 'turkey', 'morocco'];

export function costTierForDestination(destinationCountry?: string | null): CostTier {
  const c = (destinationCountry ?? '').trim().toLowerCase();
  if (!c) return 'moderate';
  if (PREMIUM.some((p) => c.includes(p))) return 'premium';
  if (BUDGET.some((b) => c.includes(b))) return 'budget';
  return 'moderate';
}

/** Tier tweaks the weighting slightly (e.g. transport heavier where it's pricey). */
function weightsForTier(tier: CostTier): Record<BudgetCategory, number> {
  const w = { ...BASE_WEIGHTS };
  if (tier === 'premium') {
    w.dining += 0.03;
    w.transport += 0.03;
    w.shopping -= 0.03;
    w.nightlife -= 0.03;
  } else if (tier === 'budget') {
    w.activities += 0.03;
    w.nightlife += 0.02;
    w.transport -= 0.03;
    w.dining -= 0.02;
  }
  return w;
}

const CATEGORIES = Object.keys(BASE_WEIGHTS) as BudgetCategory[];

export interface AutoAllocateInput {
  spendingBudget: number;
  days?: number;
  destinationCountry?: string | null;
}

export function autoAllocateBudget(input: AutoAllocateInput): BudgetAllocation[] {
  const total = Math.max(0, Math.round((input.spendingBudget || 0) * 100) / 100);
  const days = Math.max(1, Math.floor(input.days ?? 1));
  const tier = costTierForDestination(input.destinationCountry);
  const weights = weightsForTier(tier);

  // Compute cents to keep the sum exact, dumping any rounding remainder in misc.
  const totalCents = Math.round(total * 100);
  let allocatedCents = 0;
  const allocations: BudgetAllocation[] = CATEGORIES.map((category) => {
    const cents =
      category === 'misc' ? 0 : Math.round(totalCents * weights[category]);
    allocatedCents += cents;
    return {
      category,
      label: LABELS[category],
      amount: cents / 100,
      perDay: 0,
    };
  });

  const miscCents = Math.max(0, totalCents - allocatedCents);
  const misc = allocations.find((a) => a.category === 'misc')!;
  misc.amount = miscCents / 100;

  for (const a of allocations) {
    a.perDay = Math.round((a.amount / days) * 100) / 100;
  }
  return allocations;
}
