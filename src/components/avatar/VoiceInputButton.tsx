"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";

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

interface RecognitionErrorEventLike {
  readonly error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionResultEventLike) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
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

export interface VoiceInputButtonProps {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  language?: string;
}

function getRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function subscribeToRecognitionSupport(): () => void {
  // Browser support does not change during a page session, so there is no
  // event to subscribe to. useSyncExternalStore still gives hydration a
  // deliberate server snapshot instead of guessing from `window` in render.
  return () => {};
}

function getRecognitionSupportSnapshot(): boolean {
  return getRecognitionConstructor() !== null;
}

function getServerRecognitionSupportSnapshot(): boolean {
  return false;
}

function messageForRecognitionError(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied.";
    case "audio-capture":
      return "No microphone was found.";
    case "no-speech":
      return "No speech was detected. Please try again.";
    case "network":
      return "Voice recognition had a network problem. Please try again.";
    case "aborted":
      return "Voice input stopped.";
    default:
      return "Voice input failed. Please try again.";
  }
}

/**
 * Small, dependency-free Web Speech API control. It only returns finalized
 * recognition results; the parent remains responsible for deciding whether
 * a transcript should replace, append to, or submit its text input.
 */
export default function VoiceInputButton({
  onTranscript,
  disabled = false,
  language = "en-US",
}: VoiceInputButtonProps) {
  const supported = useSyncExternalStore(
    subscribeToRecognitionSupport,
    getRecognitionSupportSnapshot,
    getServerRecognitionSupportSnapshot
  );
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const hadErrorRef = useRef(false);
  const capturedTranscriptRef = useRef(false);
  const statusId = useId();

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;

      // Detach callbacks before stopping so a late browser event cannot try
      // to update React state after this component has unmounted.
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;

      if (listeningRef.current) {
        try {
          recognition.stop();
        } catch {
          try {
            recognition.abort();
          } catch {
            // The browser has already torn the recognition service down.
          }
        }
      }
      recognitionRef.current = null;
      listeningRef.current = false;
    };
  }, []);

  const createRecognition = (): BrowserSpeechRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setStatus("Voice input is not supported in this browser.");
      return null;
    }

    let recognition: BrowserSpeechRecognition;
    try {
      recognition = new Recognition();
    } catch {
      setStatus("Voice input could not start. Please try again.");
      return null;
    }

    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
      setStatus("Listening. Speak now.");
    };

    recognition.onresult = (event) => {
      const finalParts: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal || result.length === 0) continue;
        const transcript = result[0]?.transcript.trim();
        if (transcript) finalParts.push(transcript);
      }

      const transcript = finalParts.join(" ").trim();
      if (!transcript) return;
      capturedTranscriptRef.current = true;
      setStatus("Voice input captured.");
      onTranscript(transcript);
    };

    recognition.onerror = (event) => {
      hadErrorRef.current = true;
      listeningRef.current = false;
      setListening(false);
      setStatus(messageForRecognitionError(event.error));
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      if (!hadErrorRef.current) {
        setStatus(
          capturedTranscriptRef.current ? "Voice input captured." : "Voice input stopped."
        );
      }
      hadErrorRef.current = false;
      capturedTranscriptRef.current = false;
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const toggleListening = () => {
    const recognition = createRecognition();
    if (!recognition) return;

    if (listeningRef.current) {
      setStatus("Stopping voice input.");
      try {
        recognition.stop();
      } catch {
        listeningRef.current = false;
        setListening(false);
        setStatus("Voice input stopped.");
      }
      return;
    }

    hadErrorRef.current = false;
    capturedTranscriptRef.current = false;
    recognition.lang = language;
    try {
      recognition.start();
      // Some implementations dispatch `start` asynchronously. Reflect the
      // requested state immediately so the button cannot be double-started.
      listeningRef.current = true;
      setListening(true);
      setStatus("Listening. Speak now.");
    } catch {
      listeningRef.current = false;
      setListening(false);
      setStatus("Voice input could not start. Please try again.");
    }
  };

  const unavailable = !supported;
  const label = unavailable
    ? "Voice input unavailable"
    : listening
      ? "Stop voice input"
      : "Start voice input";

  return (
    <>
      <button
        type="button"
        className="td-send-btn"
        onClick={toggleListening}
        disabled={disabled || unavailable}
        aria-label={label}
        aria-pressed={listening}
        aria-describedby={statusId}
        title={label}
      >
        {listening ? (
          <MicOff size={18} aria-hidden="true" />
        ) : (
          <Mic size={18} aria-hidden="true" />
        )}
      </button>
      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {status || (unavailable ? "Voice input is not supported in this browser." : "")}
      </span>
    </>
  );
}
