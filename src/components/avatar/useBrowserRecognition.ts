"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type RecognitionFailure =
  | "unsupported"
  | "permission-denied"
  | "service-failed"
  | "no-microphone"
  | "no-speech";

interface RecognitionAlternativeLike {
  readonly transcript: string;
}

interface RecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: RecognitionAlternativeLike;
}

interface RecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: RecognitionResultLike;
}

interface RecognitionResultEventLike {
  readonly resultIndex: number;
  readonly results: RecognitionResultListLike;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionResultEventLike) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

interface SpeechRecognitionWindow {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}

export interface BrowserRecognitionOptions {
  language: string;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onFailure(reason: RecognitionFailure, message: string): void;
  onEnd(): void;
}

export interface BrowserRecognitionController {
  supported: boolean;
  listening: boolean;
  start(): void;
  stop(): void;
  abort(): void;
}

function getRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function subscribeToSupport(): () => void {
  return () => {};
}

function getSupportSnapshot(): boolean {
  return getRecognitionConstructor() !== null;
}

function getServerSupportSnapshot(): boolean {
  return false;
}

function failureForBrowserError(error: string): {
  reason: RecognitionFailure;
  message: string;
} | null {
  switch (error) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return {
        reason: "permission-denied",
        message: "Microphone permission was denied.",
      };
    case "audio-capture":
      return { reason: "no-microphone", message: "No microphone was found." };
    case "no-speech":
      return { reason: "no-speech", message: "No speech was detected. Please try again." };
    case "network":
      return {
        reason: "service-failed",
        message: "Voice recognition service is unavailable.",
      };
    default:
      return { reason: "service-failed", message: "Voice recognition could not continue." };
  }
}

export function useBrowserRecognition(
  options: BrowserRecognitionOptions
): BrowserRecognitionController {
  const supported = useSyncExternalStore(
    subscribeToSupport,
    getSupportSnapshot,
    getServerSupportSnapshot
  );
  const [listening, setListening] = useState(false);
  const optionsRef = useRef(options);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const acceptResultsRef = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const createRecognition = useCallback((): BrowserSpeechRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return null;

    let recognition: BrowserSpeechRecognition;
    try {
      recognition = new Recognition();
    } catch {
      optionsRef.current.onFailure(
        "service-failed",
        "Voice recognition could not start."
      );
      return null;
    }

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
    };
    recognition.onresult = (event) => {
      if (!acceptResultsRef.current) return;
      const interimParts: string[] = [];
      const finalParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result || result.length === 0) continue;
        const transcript = result[0]?.transcript.trim();
        if (!transcript) continue;
        (result.isFinal ? finalParts : interimParts).push(transcript);
      }

      const interim = interimParts.join(" ").trim();
      if (interim) optionsRef.current.onInterim(interim);

      const finalText = finalParts.join(" ").trim();
      if (finalText) {
        acceptResultsRef.current = false;
        optionsRef.current.onFinal(finalText);
      }
    };
    recognition.onerror = (event) => {
      listeningRef.current = false;
      acceptResultsRef.current = false;
      setListening(false);
      const failure = failureForBrowserError(event.error);
      if (failure) optionsRef.current.onFailure(failure.reason, failure.message);
    };
    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      optionsRef.current.onEnd();
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const start = useCallback(() => {
    const recognition = createRecognition();
    if (!recognition) {
      if (!getRecognitionConstructor()) {
        optionsRef.current.onFailure(
          "unsupported",
          "Voice recognition is not supported in this browser."
        );
      }
      return;
    }
    if (listeningRef.current) return;

    recognition.lang = optionsRef.current.language;
    acceptResultsRef.current = true;
    try {
      recognition.start();
      listeningRef.current = true;
      setListening(true);
    } catch {
      acceptResultsRef.current = false;
      listeningRef.current = false;
      setListening(false);
      optionsRef.current.onFailure(
        "service-failed",
        "Voice recognition could not start."
      );
    }
  }, [createRecognition]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    acceptResultsRef.current = false;
    if (!recognition || !listeningRef.current) return;
    try {
      recognition.stop();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  }, []);

  const abort = useCallback(() => {
    const recognition = recognitionRef.current;
    acceptResultsRef.current = false;
    if (!recognition || !listeningRef.current) return;
    try {
      recognition.abort();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      acceptResultsRef.current = false;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      if (listeningRef.current) {
        try {
          recognition.abort();
        } catch {
          // The browser may already have released the recognition service.
        }
      }
      listeningRef.current = false;
      recognitionRef.current = null;
    };
  }, []);

  return { supported, listening, start, stop, abort };
}
