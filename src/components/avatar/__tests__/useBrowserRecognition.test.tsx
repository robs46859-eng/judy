// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrowserRecognition } from '../useBrowserRecognition';

interface MockResult {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = true;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: MockResult } }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  emitResults(results: MockResult[]) {
    const list: { length: number; [index: number]: MockResult } = { length: results.length };
    results.forEach((value, index) => {
      list[index] = value;
    });
    this.onresult?.({ resultIndex: 0, results: list });
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

function callbacks() {
  return {
    onInterim: vi.fn(),
    onFinal: vi.fn(),
    onFailure: vi.fn(),
    onEnd: vi.fn(),
  };
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

describe('useBrowserRecognition', () => {
  it('reports unsupported browsers without attempting microphone access', () => {
    const handlers = callbacks();
    const { result: hook } = renderHook(() =>
      useBrowserRecognition({ language: 'en-US', ...handlers })
    );

    expect(hook.current.supported).toBe(false);
    act(() => hook.current.start());
    expect(handlers.onFailure).toHaveBeenCalledWith(
      'unsupported',
      'Voice recognition is not supported in this browser.'
    );
  });

  it('streams interim text and commits final text in the selected locale', () => {
    speechWindow.SpeechRecognition = MockSpeechRecognition;
    const handlers = callbacks();
    const { result: hook } = renderHook(() =>
      useBrowserRecognition({ language: 'es-MX', ...handlers })
    );

    act(() => hook.current.start());
    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition.continuous).toBe(false);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe('es-MX');
    expect(hook.current.listening).toBe(true);

    act(() => recognition.emitResults([result('hola Ju', false)]));
    expect(handlers.onInterim).toHaveBeenLastCalledWith('hola Ju');

    act(() => recognition.emitResults([result('hola Judy', true)]));
    expect(handlers.onFinal).toHaveBeenCalledWith('hola Judy');
  });

  it('stops without auto-committing a late browser result', () => {
    speechWindow.SpeechRecognition = MockSpeechRecognition;
    const handlers = callbacks();
    const { result: hook } = renderHook(() =>
      useBrowserRecognition({ language: 'en-US', ...handlers })
    );

    act(() => hook.current.start());
    const recognition = MockSpeechRecognition.instances[0];
    act(() => hook.current.stop());
    act(() => recognition.emitResults([result('do not send this', true)]));

    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(handlers.onFinal).not.toHaveBeenCalled();
    expect(handlers.onEnd).toHaveBeenCalledOnce();
  });

  it('aborts immediately and cleans up an active recognizer on unmount', () => {
    speechWindow.SpeechRecognition = MockSpeechRecognition;
    const handlers = callbacks();
    const view = renderHook(() =>
      useBrowserRecognition({ language: 'en-US', ...handlers })
    );

    act(() => view.result.current.start());
    const recognition = MockSpeechRecognition.instances[0];
    act(() => view.result.current.abort());
    expect(recognition.abort).toHaveBeenCalledOnce();

    act(() => view.result.current.start());
    view.unmount();
    expect(recognition.abort).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['not-allowed', 'permission-denied', 'Microphone permission was denied.'],
    ['audio-capture', 'no-microphone', 'No microphone was found.'],
    ['no-speech', 'no-speech', 'No speech was detected. Please try again.'],
    ['network', 'service-failed', 'Voice recognition service is unavailable.'],
  ])('maps %s errors to %s', (browserError, reason, message) => {
    speechWindow.webkitSpeechRecognition = MockSpeechRecognition;
    const handlers = callbacks();
    const { result: hook } = renderHook(() =>
      useBrowserRecognition({ language: 'en-US', ...handlers })
    );

    act(() => hook.current.start());
    act(() => MockSpeechRecognition.instances[0].emitError(browserError));

    expect(handlers.onFailure).toHaveBeenCalledWith(reason, message);
    expect(hook.current.listening).toBe(false);
  });
});
