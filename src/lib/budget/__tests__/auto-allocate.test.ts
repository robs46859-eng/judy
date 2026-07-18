import { describe, expect, it } from 'vitest';
import {
  autoAllocateBudget,
  costTierForDestination,
} from '../auto-allocate';

describe('autoAllocateBudget', () => {
  it('allocations always sum back to the input budget (rounding-exact)', () => {
    for (const budget of [1000, 1234.56, 999.99, 7, 50000]) {
      const allocations = autoAllocateBudget({ spendingBudget: budget, days: 5 });
      const sum = allocations.reduce((t, a) => t + a.amount, 0);
      expect(Math.round(sum * 100)).toBe(Math.round(budget * 100));
    }
  });

  it('computes a per-day figure from the number of days', () => {
    const allocations = autoAllocateBudget({ spendingBudget: 1000, days: 4 });
    const dining = allocations.find((a) => a.category === 'dining')!;
    expect(dining.perDay).toBeCloseTo(dining.amount / 4, 2);
  });

  it('defaults to 1 day when days is missing or invalid', () => {
    const allocations = autoAllocateBudget({ spendingBudget: 500 });
    const dining = allocations.find((a) => a.category === 'dining')!;
    expect(dining.perDay).toBeCloseTo(dining.amount, 2);
  });

  it('returns all-zero allocations for a zero budget', () => {
    const allocations = autoAllocateBudget({ spendingBudget: 0, days: 3 });
    expect(allocations.every((a) => a.amount === 0)).toBe(true);
  });

  it('tiers destinations by cost', () => {
    expect(costTierForDestination('Switzerland')).toBe('premium');
    expect(costTierForDestination('Thailand')).toBe('budget');
    expect(costTierForDestination('Brazil')).toBe('moderate');
    expect(costTierForDestination(null)).toBe('moderate');
  });

  it('shifts weighting by tier but still sums exactly', () => {
    const premium = autoAllocateBudget({ spendingBudget: 2000, days: 7, destinationCountry: 'Japan' });
    const budget = autoAllocateBudget({ spendingBudget: 2000, days: 7, destinationCountry: 'Mexico' });
    const sum = (xs: { amount: number }[]) => Math.round(xs.reduce((t, a) => t + a.amount, 0) * 100);
    expect(sum(premium)).toBe(200000);
    expect(sum(budget)).toBe(200000);
    const nightlife = (xs: { category: string; amount: number }[]) =>
      xs.find((a) => a.category === 'nightlife')!.amount;
    // Budget destinations weight nightlife a touch heavier than premium ones.
    expect(nightlife(budget)).toBeGreaterThan(nightlife(premium));
  });
});
