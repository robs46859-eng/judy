"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Send, SkipForward, ArrowLeft, RotateCcw, Pencil, Loader2, Check } from "lucide-react";
import {
  ONBOARDING_STEPS,
  currentStep,
  initialOnboardingState,
  onboardingReducer,
  type OnboardingFieldKey,
  type OnboardingState,
} from "@/lib/onboarding/stateMachine";

interface OnboardingIntakeProps {
  /** Used only to namespace the local draft — never sent anywhere. */
  userEmail: string;
  /** Called once preferences have been saved server-side. */
  onDone: () => void;
}

const FIELD_LABELS: Record<OnboardingFieldKey, string> = {
  nativeLanguage: "Native language",
  translationLanguage: "Translate to/from",
  travelRoute: "Traveling from/to",
  preTravelTasks: "Before you travel",
  helpPreference: "How I can help",
};

function draftKey(userEmail: string): string {
  return `judy-onboarding-draft:${userEmail || "anon"}`;
}

function loadDraft(userEmail: string): OnboardingState {
  if (typeof window === "undefined") return initialOnboardingState;
  try {
    const raw = window.localStorage.getItem(draftKey(userEmail));
    if (!raw) return initialOnboardingState;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.stepIndex === "number" &&
      typeof parsed.phase === "string" &&
      parsed.answers &&
      typeof parsed.answers === "object"
    ) {
      // Never resume directly into "done" or mid-edit from a stale draft.
      const phase = parsed.phase === "summary" ? "summary" : "asking";
      return {
        ...initialOnboardingState,
        stepIndex: Math.min(Math.max(0, parsed.stepIndex), ONBOARDING_STEPS.length - 1),
        answers: parsed.answers,
        skipped: parsed.skipped && typeof parsed.skipped === "object" ? parsed.skipped : {},
        phase,
        editingKey: null,
      };
    }
  } catch {
    /* corrupt draft — start fresh rather than throw */
  }
  return initialOnboardingState;
}

function saveDraft(userEmail: string, state: OnboardingState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    draftKey(userEmail),
    JSON.stringify({
      stepIndex: state.stepIndex,
      answers: state.answers,
      skipped: state.skipped,
      phase: state.phase === "done" ? "summary" : state.phase,
    })
  );
}

function clearDraft(userEmail: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(draftKey(userEmail));
}

export default function OnboardingIntake({ userEmail, onDone }: OnboardingIntakeProps) {
  const [state, dispatch] = useReducer(onboardingReducer, userEmail, loadDraft);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist the in-progress draft on every change so a page refresh mid-flow
  // resumes instead of restarting. Once done, clear it instead — otherwise
  // this same effect would resurrect a draft right after handleConfirm
  // clears it, on the re-render that CONFIRM triggers.
  useEffect(() => {
    if (state.phase === "done") {
      clearDraft(userEmail);
      return;
    }
    saveDraft(userEmail, state);
  }, [userEmail, state]);

  useEffect(() => {
    if (state.phase === "asking") {
      const key = ONBOARDING_STEPS[state.stepIndex]?.key;
      setInput(key ? state.answers[key] ?? "" : "");
    } else if (state.editingKey) {
      setInput(state.answers[state.editingKey] ?? "");
    }
    inputRef.current?.focus();
  }, [state.stepIndex, state.phase, state.editingKey, state.answers]);

  const step = currentStep(state);

  const submitAnswer = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    dispatch({ type: "ANSWER", value: trimmed });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nativeLanguage: state.answers.nativeLanguage ?? null,
          translationLanguage: state.answers.translationLanguage ?? null,
          travelRoute: state.answers.travelRoute ?? null,
          preTravelTasks: state.answers.preTravelTasks ?? null,
          helpPreference: state.answers.helpPreference ?? null,
          completeOnboarding: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error || "Could not save your preferences. Please try again.");
        setSaving(false);
        return;
      }
      // Only ever mark done — and only ever save anything — after this
      // explicit confirm succeeds server-side.
      dispatch({ type: "CONFIRM" });
      clearDraft(userEmail);
      setSaving(false);
      onDone();
    } catch {
      setSaveError("Network error — please try again.");
      setSaving(false);
    }
  };

  const handleRestart = () => {
    clearDraft(userEmail);
    dispatch({ type: "RESTART" });
    setSaveError(null);
  };

  if (state.phase === "done") {
    return (
      <div className="onboarding-intake">
        <div className="onboarding-done">
          <Check size={18} /> Saved — thanks!
        </div>
      </div>
    );
  }

  if (state.phase === "summary") {
    const editingKey = state.editingKey;
    return (
      <div className="onboarding-intake">
        <div className="onboarding-transcript">
          <div className="td-msg td-msg-daddy">
            <div className="td-msg-bubble">
              Here&apos;s what I&apos;ve got — anything to change before I save it?
            </div>
          </div>
        </div>

        <div className="onboarding-summary">
          {ONBOARDING_STEPS.map(({ key }) => {
            const answer = state.answers[key];
            const isSkipped = !!state.skipped[key];
            const isEditing = editingKey === key;
            return (
              <div className="onboarding-summary-row" key={key}>
                <div className="onboarding-summary-label">{FIELD_LABELS[key]}</div>
                {isEditing ? (
                  <div className="onboarding-summary-edit">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="td-chat-input"
                      placeholder={FIELD_LABELS[key]}
                    />
                    <button
                      className="td-send-btn"
                      title="Save this answer"
                      onClick={submitAnswer}
                      disabled={!input.trim()}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="onboarding-summary-value">
                    <span>{isSkipped || !answer ? "Skipped" : answer}</span>
                    <button
                      className="onboarding-icon-btn"
                      title={`Edit ${FIELD_LABELS[key]}`}
                      onClick={() => dispatch({ type: "EDIT", key })}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {saveError && <div className="onboarding-error">{saveError}</div>}

        <div className="onboarding-actions">
          <button className="onboarding-secondary-btn" title="Restart" onClick={handleRestart}>
            <RotateCcw size={14} /> Restart
          </button>
          <button
            className="widget-action-btn onboarding-confirm-btn"
            title="Confirm and save"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? <Loader2 size={16} className="spinner" /> : <Check size={16} />}
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    );
  }

  // phase === "asking"
  return (
    <div className="onboarding-intake">
      <div className="onboarding-transcript">
        {ONBOARDING_STEPS.slice(0, state.stepIndex).map(({ key, prompt }) => (
          <div key={key}>
            <div className="td-msg td-msg-daddy">
              <div className="td-msg-bubble">{prompt}</div>
            </div>
            <div className="td-msg td-msg-user">
              <div className="td-msg-bubble">
                {state.skipped[key] || !state.answers[key] ? "(skipped)" : state.answers[key]}
              </div>
            </div>
          </div>
        ))}
        {step && (
          <div className="td-msg td-msg-daddy">
            <div className="td-msg-bubble">{step.prompt}</div>
          </div>
        )}
      </div>

      <div className="onboarding-actions">
        <button
          className="onboarding-secondary-btn"
          title="Back"
          onClick={() => dispatch({ type: "BACK" })}
          disabled={state.stepIndex === 0}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          className="onboarding-secondary-btn"
          title="Skip this question"
          onClick={() => dispatch({ type: "SKIP" })}
        >
          <SkipForward size={14} /> Skip
        </button>
      </div>

      <div className="td-chat-input-bar">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer…"
          className="td-chat-input"
          aria-label={step?.prompt ?? "Your answer"}
        />
        <button
          className="td-send-btn"
          onClick={submitAnswer}
          disabled={!input.trim()}
          title="Send answer"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
