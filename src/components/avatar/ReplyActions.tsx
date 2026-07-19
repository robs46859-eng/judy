"use client";

import { useState } from "react";
import { Copy, Languages, Loader2, Volume2 } from "lucide-react";
import { useHermesJob } from "@/lib/hermes/useHermesJob";
import { extractHermesText } from "@/lib/hermes/result";
import {
  getTranslationLanguageName,
  SPOKEN_LANGUAGE_OPTIONS,
} from "@/lib/voice/catalog";

export interface ReplyActionsProps {
  originalText: string;
  originalLanguage?: string | null;
  onSpeak(text: string, language?: string): Promise<void>;
}

export default function ReplyActions({
  originalText,
  originalLanguage,
  onSpeak,
}: ReplyActionsProps) {
  const translation = useHermesJob("translate");
  const [targetLocale, setTargetLocale] = useState("");
  const [status, setStatus] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const translatedText = targetLocale ? extractHermesText(translation.result) : null;

  const copyReply = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(originalText);
      setStatus("Copied");
    } catch {
      setStatus("Copy is unavailable in this browser.");
    }
  };

  const selectLanguage = (locale: string) => {
    setTargetLocale(locale);
    setStatus("");
    if (!locale) {
      translation.reset();
      return;
    }

    const targetLanguage = getTranslationLanguageName(locale);
    if (!targetLanguage) return;
    const sourceLanguage = getTranslationLanguageName(originalLanguage);
    void translation.submit({
      input: originalText,
      ...(sourceLanguage ? { source_language: sourceLanguage } : {}),
      target_language: targetLanguage,
    });
  };

  const speakTranslation = async () => {
    if (!translatedText || !targetLocale || speaking) return;
    setSpeaking(true);
    setStatus("Speaking translation");
    try {
      await onSpeak(translatedText, targetLocale);
      setStatus("Translation finished");
    } catch {
      setStatus("Could not speak this translation.");
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <div className="judy-reply-actions">
      <p className="judy-reply-original">{originalText}</p>
      <div className="judy-reply-action-row">
        <button type="button" onClick={copyReply} aria-label="Copy reply">
          <Copy size={15} aria-hidden="true" /> Copy
        </button>
        <label className="judy-reply-language">
          <Languages size={15} aria-hidden="true" />
          <span className="sr-only">Translate Judy’s reply</span>
          <select
            value={targetLocale}
            onChange={(event) => selectLanguage(event.target.value)}
            aria-label="Translate Judy’s reply"
            disabled={translation.isBusy}
          >
            <option value="">Translate…</option>
            {SPOKEN_LANGUAGE_OPTIONS.map((language) => (
              <option key={language.locale} value={language.locale}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void speakTranslation()}
          disabled={!translatedText || speaking || translation.isBusy}
          aria-label="Speak translation"
        >
          {speaking ? (
            <Loader2 size={15} className="spinner" aria-hidden="true" />
          ) : (
            <Volume2 size={15} aria-hidden="true" />
          )}
          Speak translation
        </button>
      </div>

      {targetLocale && translatedText && (
        <p className="judy-reply-translation" lang={targetLocale}>
          {translatedText}
        </p>
      )}
      {translation.error && <p className="judy-reply-error">{translation.error}</p>}
      {status && (
        <span className="judy-reply-status" role="status" aria-live="polite">
          {status}
        </span>
      )}
    </div>
  );
}
