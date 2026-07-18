"use client";

import { useEffect, useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { APPROVED_VOICES } from "@/lib/voice/catalog";

export const SPEECH_SYNTHESIS_STORAGE_KEY = "judy-speech-synthesis-enabled";

/**
 * Voice preference controls (Swarm J5): pick from the server-approved
 * catalog only (persisted via PATCH /api/user/preferences), plus a
 * feature-flagged toggle for browser speech synthesis on the GLB/text
 * fallback. The toggle is a local, client-only preference — no server
 * round-trip needed for something this low-stakes.
 */
export default function VoiceSettings() {
  const [voiceId, setVoiceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SPEECH_SYNTHESIS_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/preferences");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setVoiceId(data?.voiceId ?? "");
      } catch {
        /* leave the default — this is a nice-to-have control */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVoiceChange = async (next: string) => {
    setVoiceId(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: next || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Could not save voice preference.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSpeechToggle = (checked: boolean) => {
    setSpeechEnabled(checked);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SPEECH_SYNTHESIS_STORAGE_KEY, String(checked));
    }
  };

  return (
    <>
      <div className="settings-group">
        <label htmlFor="voice-catalog-select">
          <Volume2 size={14} aria-hidden="true" /> Judy Pierre voice
        </label>
        <span className="voice-select-wrap">
          <select
            id="voice-catalog-select"
            value={voiceId}
            onChange={(e) => handleVoiceChange(e.target.value)}
            disabled={loading || saving}
          >
            <option value="">Default</option>
            {APPROVED_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}
              </option>
            ))}
          </select>
          {saving && <Loader2 size={14} className="spinner" aria-hidden="true" />}
        </span>
      </div>
      {error && (
        <div className="onboarding-error" role="alert">
          {error}
        </div>
      )}

      <div className="settings-group">
        <label htmlFor="speech-synthesis-toggle">Read replies aloud (browser voice, when not live)</label>
        <input
          id="speech-synthesis-toggle"
          type="checkbox"
          checked={speechEnabled}
          onChange={(e) => handleSpeechToggle(e.target.checked)}
        />
      </div>
    </>
  );
}
