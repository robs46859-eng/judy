"use client";

import { CommitStrategy, useScribe } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ScribeFallbackOptions {
  languageCode?: string;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onFailure(message: string): void;
}

export interface ScribeFallbackController {
  listening: boolean;
  start(): Promise<void>;
  stop(): void;
  abort(): void;
}

export function useScribeFallback(
  options: ScribeFallbackOptions
): ScribeFallbackController {
  const [starting, setStarting] = useState(false);
  const optionsRef = useRef(options);
  const activeRef = useRef(false);
  const tokenRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 0.8,
    vadThreshold: 0.4,
    microphone: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    onPartialTranscript: ({ text }) => {
      const transcript = text.trim();
      if (activeRef.current && transcript) optionsRef.current.onInterim(transcript);
    },
    onCommittedTranscript: ({ text }) => {
      const transcript = text.trim();
      if (!activeRef.current || !transcript) return;
      activeRef.current = false;
      optionsRef.current.onFinal(transcript);
    },
    onError: () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      setStarting(false);
      optionsRef.current.onFailure("Voice transcription could not continue.");
    },
  });

  const disconnect = scribe.disconnect;
  const connect = scribe.connect;

  const stop = useCallback(() => {
    activeRef.current = false;
    tokenRequestRef.current?.abort();
    tokenRequestRef.current = null;
    setStarting(false);
    disconnect();
  }, [disconnect]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    setStarting(true);
    const controller = new AbortController();
    tokenRequestRef.current = controller;

    try {
      const response = await fetch("/api/avatar/transcription-token", {
        method: "POST",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        token?: unknown;
        error?: unknown;
      };
      if (!response.ok || typeof payload.token !== "string" || !payload.token.trim()) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Voice transcription could not start."
        );
      }
      if (!activeRef.current || controller.signal.aborted) return;

      await connect({
        token: payload.token,
        modelId: "scribe_v2_realtime",
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: 0.8,
        vadThreshold: 0.4,
        ...(optionsRef.current.languageCode
          ? { languageCode: optionsRef.current.languageCode }
          : {}),
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (!activeRef.current || controller.signal.aborted) disconnect();
    } catch (error) {
      if (controller.signal.aborted) return;
      activeRef.current = false;
      optionsRef.current.onFailure(
        error instanceof Error ? error.message : "Voice transcription could not start."
      );
    } finally {
      if (tokenRequestRef.current === controller) tokenRequestRef.current = null;
      setStarting(false);
    }
  }, [connect, disconnect]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      tokenRequestRef.current?.abort();
      tokenRequestRef.current = null;
      disconnect();
    };
  }, [disconnect]);

  return {
    listening: starting || scribe.isConnected || scribe.isTranscribing,
    start,
    stop,
    abort: stop,
  };
}
