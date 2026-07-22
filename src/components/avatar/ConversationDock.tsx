"use client";

import { Keyboard, Mic, Pause, Send, Square } from "lucide-react";
import type { ConversationState } from "./conversationMachine";

export interface ConversationDockProps {
  state: ConversationState;
  onStart(): void;
  onStopListening(): void;
  onTranscriptChange(text: string): void;
  onSubmit(): void;
  onResume(): void;
  onEnd(): void;
  onTypeInstead(): void;
  onSuggestion(suggestion: "plan" | "translate" | "nearby"): void;
}

const STATUS_LABELS = {
  welcoming: "Judy is getting ready",
  thinking: "Judy is thinking",
  speaking: "Judy is speaking",
  paused: "Conversation paused",
} as const;

export default function ConversationDock({
  state,
  onStart,
  onStopListening,
  onTranscriptChange,
  onSubmit,
  onResume,
  onEnd,
  onTypeInstead,
  onSuggestion,
}: ConversationDockProps) {
  if (state.phase === "idle") {
    return (
      <section className="judy-conversation-dock judy-conversation-idle" aria-label="Talk with Judy Pierre">
        <p>Judy will speak, listen, and help with your trip.</p>
        <div className="judy-conversation-actions">
          <button type="button" className="judy-talk-primary" onClick={onStart}>
            <Mic size={18} aria-hidden="true" /> Talk with Judy
          </button>
          <button type="button" className="judy-conversation-secondary" onClick={onTypeInstead}>
            <Keyboard size={17} aria-hidden="true" /> Type instead
          </button>
        </div>
        <div className="judy-conversation-suggestions" aria-label="Try asking Judy">
          <button type="button" onClick={() => onSuggestion("plan")}>Plan my trip</button>
          <button type="button" onClick={() => onSuggestion("translate")}>Translate a phrase</button>
          <button type="button" onClick={() => onSuggestion("nearby")}>What should I do nearby?</button>
        </div>
      </section>
    );
  }

  if (state.phase === "listening") {
    return (
      <section className="judy-conversation-dock is-listening" aria-label="Judy is listening">
        <div className="judy-conversation-status" role="status" aria-live="polite">
          <span className="judy-listening-pulse" aria-hidden="true" /> Listening
        </div>
        <div className="judy-live-transcript" aria-live="polite">
          {state.interimTranscript || state.finalTranscript || "Speak now…"}
        </div>
        <div className="judy-conversation-actions">
          <button type="button" className="judy-conversation-secondary" onClick={onStopListening}>
            <Pause size={17} aria-hidden="true" /> Stop listening
          </button>
          <button type="button" className="judy-conversation-secondary" onClick={onTypeInstead}>
            <Keyboard size={17} aria-hidden="true" /> Type instead
          </button>
          <button type="button" className="judy-conversation-end" onClick={onEnd}>
            <Square size={16} aria-hidden="true" /> End conversation
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "editing") {
    return (
      <section className="judy-conversation-dock is-editing" aria-label="Edit voice transcript">
        <label htmlFor="judy-corrected-transcript">Correct what Judy heard</label>
        <textarea
          id="judy-corrected-transcript"
          value={state.finalTranscript}
          onChange={(event) => onTranscriptChange(event.target.value)}
          rows={3}
        />
        <div className="judy-conversation-actions">
          <button
            type="button"
            className="judy-talk-primary"
            onClick={onSubmit}
            disabled={!state.finalTranscript.trim()}
            aria-label="Send corrected transcript"
          >
            <Send size={17} aria-hidden="true" /> Send
          </button>
          <button type="button" className="judy-conversation-secondary" onClick={onResume}>
            <Mic size={17} aria-hidden="true" /> Resume listening
          </button>
          <button type="button" className="judy-conversation-end" onClick={onEnd}>
            <Square size={16} aria-hidden="true" /> End conversation
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "error") {
    return (
      <section className="judy-conversation-dock is-error" aria-label="Voice conversation error">
        <div role="alert">{state.error || "Voice conversation is unavailable."}</div>
        <div className="judy-conversation-actions">
          <button type="button" className="judy-conversation-secondary" onClick={onResume}>
            <Mic size={17} aria-hidden="true" /> Resume listening
          </button>
          <button type="button" className="judy-conversation-secondary" onClick={onTypeInstead}>
            <Keyboard size={17} aria-hidden="true" /> Type instead
          </button>
          <button type="button" className="judy-conversation-end" onClick={onEnd}>
            <Square size={16} aria-hidden="true" /> End conversation
          </button>
        </div>
      </section>
    );
  }

  const label = STATUS_LABELS[state.phase];
  return (
    <section className={`judy-conversation-dock is-${state.phase}`} aria-label={label}>
      <div className="judy-conversation-status" role="status" aria-live="polite">
        {label}
      </div>
      <button type="button" className="judy-conversation-end" onClick={onEnd}>
        <Square size={16} aria-hidden="true" /> End conversation
      </button>
    </section>
  );
}
