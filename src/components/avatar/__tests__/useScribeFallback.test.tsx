// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scribeMock = vi.hoisted(() => ({
  options: null as null | {
    onPartialTranscript?(data: { text: string }): void;
    onCommittedTranscript?(data: { text: string }): void;
    onError?(error: Error): void;
  },
  status: 'disconnected',
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(),
}));

vi.mock('@elevenlabs/react', () => ({
  CommitStrategy: { VAD: 'vad' },
  useScribe: (options: typeof scribeMock.options) => {
    scribeMock.options = options;
    return {
      status: scribeMock.status,
      isConnected: scribeMock.status === 'connected' || scribeMock.status === 'transcribing',
      isTranscribing: scribeMock.status === 'transcribing',
      connect: scribeMock.connect,
      disconnect: scribeMock.disconnect,
    };
  },
}));

import { useScribeFallback } from '../useScribeFallback';

function callbacks() {
  return {
    onInterim: vi.fn(),
    onFinal: vi.fn(),
    onFailure: vi.fn(),
  };
}

beforeEach(() => {
  scribeMock.options = null;
  scribeMock.status = 'disconnected';
  scribeMock.connect.mockClear();
  scribeMock.disconnect.mockClear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useScribeFallback', () => {
  it('fetches a server-minted token and connects with VAD in the selected locale', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ token: 'single-use-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const handlers = callbacks();
    const { result } = renderHook(() =>
      useScribeFallback({ languageCode: 'es-MX', ...handlers })
    );

    await act(async () => result.current.start());

    expect(fetch).toHaveBeenCalledWith(
      '/api/avatar/transcription-token',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
    );
    expect(scribeMock.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'single-use-token',
        modelId: 'scribe_v2_realtime',
        commitStrategy: 'vad',
        languageCode: 'es-MX',
        microphone: expect.objectContaining({
          echoCancellation: true,
          noiseSuppression: true,
        }),
      })
    );
  });

  it('forwards partial and committed transcripts without an approval gate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ token: 'token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const handlers = callbacks();
    const { result } = renderHook(() =>
      useScribeFallback({ languageCode: 'en-US', ...handlers })
    );
    await act(async () => result.current.start());

    act(() => scribeMock.options?.onPartialTranscript?.({ text: 'where should' }));
    act(() => scribeMock.options?.onCommittedTranscript?.({ text: 'where should I stay' }));

    expect(handlers.onInterim).toHaveBeenCalledWith('where should');
    expect(handlers.onFinal).toHaveBeenCalledWith('where should I stay');
  });

  it('disconnects on Stop and suppresses a late committed transcript', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ token: 'token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const handlers = callbacks();
    const { result } = renderHook(() =>
      useScribeFallback({ languageCode: 'en-US', ...handlers })
    );
    await act(async () => result.current.start());
    act(() => result.current.stop());
    act(() => scribeMock.options?.onCommittedTranscript?.({ text: 'do not send' }));

    expect(scribeMock.disconnect).toHaveBeenCalledOnce();
    expect(handlers.onFinal).not.toHaveBeenCalled();
  });

  it('shows a safe failure when a fallback token cannot be created', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Voice transcription is not configured' }), {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const handlers = callbacks();
    const { result } = renderHook(() =>
      useScribeFallback({ languageCode: 'en-US', ...handlers })
    );

    await act(async () => result.current.start());
    expect(handlers.onFailure).toHaveBeenCalledWith(
      'Voice transcription is not configured'
    );
  });

  it('disconnects during unmount cleanup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ token: 'token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const view = renderHook(() =>
      useScribeFallback({ languageCode: 'en-US', ...callbacks() })
    );
    await act(async () => view.result.current.start());
    view.unmount();

    await waitFor(() => expect(scribeMock.disconnect).toHaveBeenCalled());
  });
});
