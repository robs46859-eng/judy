"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Loader2, MapPin, Compass } from "lucide-react";

/**
 * Self-contained experiences panel for the avatar hub. Fetches curated
 * gay-tailored experiences for the current trip destination and renders them as
 * cards, with quick category chips. Kept standalone so the avatar only needs a
 * button + <ExperiencesPanel/> mount.
 */

interface Experience {
  id: string;
  title: string;
  category: string;
  description: string;
  city?: string;
  country?: string;
  priceFrom?: number;
  currency?: string;
  durationHours?: number;
  tags: string[];
  global?: boolean;
}

const CATEGORIES = [
  "all",
  "tour",
  "tickets",
  "dining",
  "hike",
  "cruise",
  "event",
  "nightlife",
  "excursion",
] as const;

interface ExperiencesPanelProps {
  open: boolean;
  onClose: () => void;
  destinationName?: string | null;
}

export default function ExperiencesPanel({
  open,
  onClose,
  destinationName,
}: ExperiencesPanelProps) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (destinationName) params.set("destination", destinationName);
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/experiences?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setExperiences(Array.isArray(data.experiences) ? data.experiences : []);
    } catch {
      setError("Couldn't load experiences right now.");
      setExperiences([]);
    } finally {
      setLoading(false);
    }
  }, [destinationName, category]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  return (
    <div className="judy-chat-panel judy-experiences-panel">
      <div className="judy-chat-header">
        <div className="judy-chat-title">
          <Compass size={16} aria-hidden="true" />
          <span>Experiences{destinationName ? ` · ${destinationName}` : ""}</span>
        </div>
        <button
          className="judy-chat-close"
          onClick={onClose}
          aria-label="Close experiences panel"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="judy-exp-cats">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`judy-exp-cat${category === c ? " active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="judy-exp-list">
        {loading && (
          <div className="judy-exp-hint">
            <Loader2 size={16} className="spinner" aria-hidden="true" /> Finding experiences…
          </div>
        )}
        {error && !loading && <div className="judy-exp-error">{error}</div>}
        {!loading && !error && experiences.length === 0 && (
          <div className="judy-exp-hint">No experiences yet for this filter.</div>
        )}
        {!loading &&
          !error &&
          experiences.map((exp) => (
            <div key={exp.id} className="judy-exp-card">
              <div className="judy-exp-card-head">
                <span className="judy-exp-cat-tag">{exp.category}</span>
                {(exp.city || exp.country) && (
                  <span className="judy-exp-loc">
                    <MapPin size={12} aria-hidden="true" />
                    {[exp.city, exp.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
              <strong className="judy-exp-title">{exp.title}</strong>
              <p className="judy-exp-desc">{exp.description}</p>
              <div className="judy-exp-meta">
                {typeof exp.priceFrom === "number" && (
                  <span className="judy-exp-price">
                    from {exp.currency ?? "$"}
                    {exp.priceFrom}
                  </span>
                )}
                {typeof exp.durationHours === "number" && (
                  <span className="judy-exp-dur">{exp.durationHours}h</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
