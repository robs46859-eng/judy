"use client";

import { useEffect, useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { APPROVED_VOICES, SPOKEN_LANGUAGE_OPTIONS } from "@/lib/voice/catalog";

export const SPEECH_SYNTHESIS_STORAGE_KEY = "judy-speech-synthesis-enabled";

/**
 * Voice preference controls (Swarm J5): pick from the server-approved
 * catalog only (persisted via PATCH /api/user/preferences), plus a
 * read-aloud toggle for Judy's local GLB speech. The toggle is a local,
 * client-only preference — no server
 * round-trip needed for something this low-stakes.
 */
export default function VoiceSettings() {
  const [voiceId, setVoiceId] = useState<string>("");
  const [spokenLanguage, setSpokenLanguage] = useState<string>("");
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
        if (!cancelled) {
          setVoiceId(data?.voiceId ?? "");
          setSpokenLanguage(data?.spokenLanguage ?? "");
        }
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

  const savePreferences = async (nextVoiceId: string, nextSpokenLanguage: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: nextVoiceId || null,
          spokenLanguage: nextSpokenLanguage || null,
        }),
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

  const handleVoiceChange = (next: string) => {
    setVoiceId(next);
    void savePreferences(next, spokenLanguage);
  };

  const handleSpokenLanguageChange = (next: string) => {
    setSpokenLanguage(next);
    void savePreferences(voiceId, next);
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
                {voice.label} — {voice.personality}
              </option>
            ))}
          </select>
          {saving && <Loader2 size={14} className="spinner" aria-hidden="true" />}
        </span>
      </div>
      <div className="settings-group">
        <label htmlFor="spoken-language-select">
          <Volume2 size={14} aria-hidden="true" /> Spoken language
        </label>
        <select
          id="spoken-language-select"
          value={spokenLanguage}
          onChange={(e) => handleSpokenLanguageChange(e.target.value)}
          disabled={loading || saving}
        >
          <option value="">Match reply language</option>
          {SPOKEN_LANGUAGE_OPTIONS.map((language) => (
            <option key={language.locale} value={language.locale}>
              {language.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div className="onboarding-error" role="alert">
          {error}
        </div>
      )}

      <div className="settings-group">
        <label htmlFor="speech-synthesis-toggle">Speak Judy’s replies automatically</label>
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
