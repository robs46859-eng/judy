// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VoiceInputButton from "../VoiceInputButton";

interface MockAlternative {
  transcript: string;
}

interface MockResult {
  isFinal: boolean;
  length: number;
  [index: number]: MockAlternative;
}

interface MockResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: MockResult;
  };
}

interface MockErrorEvent {
  error: string;
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = true;
  interimResults = false;
  lang = "";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: MockResultEvent) => void) | null = null;
  onerror: ((event: MockErrorEvent) => void) | null = null;

  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  emitResults(results: MockResult[]) {
    const resultList: MockResultEvent["results"] = { length: results.length };
    results.forEach((result, index) => {
      resultList[index] = result;
    });
    this.onresult?.({ resultIndex: 0, results: resultList });
  }

  emitError(error: string) {
    this.onerror?.({ error });
  }
}

interface RecognitionTestWindow {
  SpeechRecognition?: typeof MockSpeechRecognition;
  webkitSpeechRecognition?: typeof MockSpeechRecognition;
}

const speechWindow = window as Window & RecognitionTestWindow;

function result(transcript: string, isFinal: boolean): MockResult {
  return { 0: { transcript }, isFinal, length: 1 };
}

function installRecognition(kind: "standard" | "webkit" = "standard") {
  if (kind === "standard") {
    speechWindow.SpeechRecognition = MockSpeechRecognition;
  } else {
    speechWindow.webkitSpeechRecognition = MockSpeechRecognition;
  }
}

beforeEach(() => {
  MockSpeechRecognition.instances = [];
  delete speechWindow.SpeechRecognition;
  delete speechWindow.webkitSpeechRecognition;
});

afterEach(() => {
  cleanup();
  delete speechWindow.SpeechRecognition;
  delete speechWindow.webkitSpeechRecognition;
});

describe("VoiceInputButton", () => {
  it("disables itself and explains when browser speech recognition is unsupported", async () => {
    render(<VoiceInputButton onTranscript={vi.fn()} />);

    const button = await screen.findByRole("button", { name: "Voice input unavailable" });
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Voice input is not supported in this browser."
    );
  });

  it("starts recognition accessibly and configures the requested language", async () => {
    installRecognition();
    render(<VoiceInputButton onTranscript={vi.fn()} language="es-MX" />);

    const button = await screen.findByRole("button", { name: "Start voice input" });
    fireEvent.click(button);

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition.start).toHaveBeenCalledOnce();
    expect(recognition.continuous).toBe(false);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe("es-MX");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Listening. Speak now.");
  });

  it("returns only finalized, non-empty transcript text", async () => {
    installRecognition();
    const onTranscript = vi.fn();
    render(<VoiceInputButton onTranscript={onTranscript} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start voice input" }));

    act(() => {
      MockSpeechRecognition.instances[0].emitResults([
        result("still listening", false),
        result("  hello Judy  ", true),
        result("take me to Paris", true),
      ]);
    });

    expect(onTranscript).toHaveBeenCalledOnce();
    expect(onTranscript).toHaveBeenCalledWith("hello Judy take me to Paris");
    expect(screen.getByRole("status")).toHaveTextContent("Voice input captured.");
  });

  it("stops recognition when the active button is pressed again", async () => {
    installRecognition();
    render(<VoiceInputButton onTranscript={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Start voice input" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop voice input" }));

    expect(MockSpeechRecognition.instances[0].stop).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start voice input" })).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    );
  });

  it("supports the prefixed API and handles microphone permission denial", async () => {
    installRecognition("webkit");
    render(<VoiceInputButton onTranscript={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start voice input" }));

    act(() => {
      MockSpeechRecognition.instances[0].emitError("not-allowed");
    });

    expect(screen.getByRole("status")).toHaveTextContent("Microphone permission was denied.");
    expect(screen.getByRole("button", { name: "Start voice input" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("stops an active recognition session on unmount", async () => {
    installRecognition();
    const view = render(<VoiceInputButton onTranscript={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start voice input" }));
    const recognition = MockSpeechRecognition.instances[0];

    view.unmount();

    expect(recognition.stop).toHaveBeenCalledOnce();
  });
});
