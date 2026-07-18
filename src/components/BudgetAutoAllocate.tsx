"use client";

import { useState } from "react";
import { Loader2, Wand2, Check } from "lucide-react";

/**
 * One-click spending-budget auto-allocation for a trip. Previews the proposed
 * split (per-category + per-day), then applies it as the trip's budget items.
 * Self-contained: only fetches on user action.
 */

interface Allocation {
  category: string;
  label: string;
  amount: number;
  perDay: number;
}

interface BudgetAutoAllocateProps {
  tripId: string;
  onApplied?: () => void;
}

export default function BudgetAutoAllocate({ tripId, onApplied }: BudgetAutoAllocateProps) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const preview = async () => {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/budget/auto-allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllocations(Array.isArray(data.allocations) ? data.allocations : null);
      setTier(data.tier ?? null);
    } catch {
      setError("Couldn't compute a budget right now.");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/budget/auto-allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, persist: true }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      setAllocations(null);
      onApplied?.();
    } catch {
      setError("Couldn't apply the budget.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="budget-auto">
      <div className="budget-auto-head">
        <button className="widget-action-btn" onClick={preview} disabled={loading}>
          {loading ? <Loader2 size={16} className="spinner" /> : <Wand2 size={16} />}
          Auto-allocate spending budget
        </button>
        {tier && <span className="budget-auto-tier">{tier} destination</span>}
      </div>

      {error && <div className="budget-auto-error">{error}</div>}
      {done && (
        <div className="budget-auto-done">
          <Check size={14} /> Applied to your budget.
        </div>
      )}

      {allocations && (
        <div className="budget-auto-preview">
          {allocations.map((a) => (
            <div key={a.category} className="budget-auto-row">
              <span>{a.label}</span>
              <span>
                ${a.amount.toFixed(2)} · ${a.perDay.toFixed(2)}/day
              </span>
            </div>
          ))}
          <button className="save-trip-btn" onClick={apply} disabled={applying}>
            {applying ? <Loader2 size={16} className="spinner" /> : <Check size={16} />}
            Apply to budget
          </button>
        </div>
      )}
    </div>
  );
}
