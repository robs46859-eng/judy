// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, act, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import JudyDock from '../JudyDock';

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

// AvatarStage wraps a real @react-three/fiber <Canvas>, which needs a real
// WebGL context — meaningless (and unsupported) in jsdom. Stub it so these
// tests exercise JudyDock's own primary/fallback logic, not Three.js.
// `avatarStageMock.shouldFail` lets a test simulate AvatarStage's
// onUnavailable callback (a failed GLTF load / no WebGL) the same way the
// real component's error boundary would report it.
const avatarStageMock = vi.hoisted(() => ({ shouldFail: false }));
vi.mock('../avatar/AvatarStage', () => ({
  default: ({
    modelUrl,
    talking,
    cues,
    onUnavailable,
  }: {
    modelUrl: string;
    talking: boolean;
    cues?: unknown[] | null;
    onUnavailable?: () => void;
  }) => {
    if (avatarStageMock.shouldFail) {
      setTimeout(() => onUnavailable?.(), 0);
    }
    return (
      <div
        data-testid="avatar-stage-stub"
        data-model-url={modelUrl}
        data-talking={String(talking)}
        data-cue-count={cues?.length ?? 0}
      />
    );
  },
}));

const recognitionMock = vi.hoisted(() => ({
  options: null as null | {
    language: string;
    onInterim(text: string): void;
    onFinal(text: string): void;
    onFailure(reason: string, message: string): void;
    onEnd(): void;
  },
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
}));

const scribeFallbackMock = vi.hoisted(() => ({
  options: null as null | {
    languageCode?: string;
    onInterim(text: string): void;
    onFinal(text: string): void;
    onFailure(message: string): void;
  },
  start: vi.fn(async () => {}),
  stop: vi.fn(),
  abort: vi.fn(),
}));

vi.mock('../avatar/useBrowserRecognition', () => ({
  useBrowserRecognition: (options: NonNullable<typeof recognitionMock.options>) => {
    recognitionMock.options = options;
    return {
      supported: true,
      listening: false,
      start: recognitionMock.start,
      stop: recognitionMock.stop,
      abort: recognitionMock.abort,
    };
  },
}));

vi.mock('../avatar/useScribeFallback', () => ({
  useScribeFallback: (options: NonNullable<typeof scribeFallbackMock.options>) => {
    scribeFallbackMock.options = options;
    return {
      listening: false,
      start: scribeFallbackMock.start,
      stop: scribeFallbackMock.stop,
      abort: scribeFallbackMock.abort,
    };
  },
}));

const AVATAR_ALT = "Judy Pierre, Judy's travel translator and guide";

beforeEach(() => {
  avatarStageMock.shouldFail = false;
  recognitionMock.options = null;
  recognitionMock.start.mockClear();
  recognitionMock.stop.mockClear();
  recognitionMock.abort.mockClear();
  scribeFallbackMock.options = null;
  scribeFallbackMock.start.mockClear();
  scribeFallbackMock.stop.mockClear();
  scribeFallbackMock.abort.mockClear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('JudyDock avatar fallback (Swarm J7)', () => {
  it('shows the rigged GLB avatar by default — the flat portrait is not the everyday avatar anymore', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 501, json: async () => ({}) }) as Response)
    );

    render(<JudyDock userName="Robert" />);

    expect(await screen.findByTestId('avatar-stage-stub')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-stage-stub')).toHaveAttribute(
      'data-model-url',
      '/models/judyface-runtime/judyface.gltf'
    );
    expect(screen.queryByAltText(AVATAR_ALT)).not.toBeInTheDocument();

    // Text + translation entry points must still be usable regardless of avatar mode.
    expect(screen.getByRole('button', { name: 'Type instead' })).toBeInTheDocument();
    expect(screen.getByTitle('Translate a phrase')).toBeInTheDocument();
  });

  it('loads an activated Avatar Manager model URL when one is provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 501, json: async () => ({}) }) as Response)
    );

    render(<JudyDock userName="Robert" avatarModelUrl="/api/avatar/model?v=abc123" />);

    expect(await screen.findByTestId('avatar-stage-stub')).toHaveAttribute(
      'data-model-url',
      '/api/avatar/model?v=abc123'
    );
  });

  it('shows the GLB avatar when unrelated network requests fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unavailable');
      })
    );

    render(<JudyDock userName="Robert" />);

    await waitFor(() => expect(screen.getByTestId('avatar-stage-stub')).toBeInTheDocument());
    // The sunset live-video path is absent, so the GLB/text/translation stay usable.
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });

  it('falls back to the static robjudy.jpg portrait when the GLB avatar reports it cannot render', async () => {
    avatarStageMock.shouldFail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 501, json: async () => ({}) }) as Response)
    );

    render(<JudyDock userName="Robert" />);

    const avatarImg = await screen.findByAltText(AVATAR_ALT);
    expect(avatarImg).toHaveAttribute('src', '/avatars/robjudy.jpg');
    expect(screen.queryByTestId('avatar-stage-stub')).not.toBeInTheDocument();
  });

  it('uses one Judy tool surface and keeps only one intelligence drawer open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ onboardingCompletedAt: new Date().toISOString(), experiences: [] }),
        headers: { get: () => null },
      }) as unknown as Response)
    );

    render(<JudyDock userName="Robert" />);
    const tools = await screen.findByRole('navigation', { name: 'Judy tools' });

    fireEvent.click(within(tools).getByRole('button', { name: 'Translate a phrase' }));
    expect(screen.getByRole('button', { name: 'Close translate panel' })).toBeInTheDocument();

    fireEvent.click(within(tools).getByRole('button', { name: 'Browse experiences' }));
    expect(screen.queryByRole('button', { name: 'Close translate panel' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Close experiences panel' })).toBeInTheDocument();
  });
});

describe('JudyDock local conversation controls', () => {
  it('makes local Judy the primary Talk action and never calls the retired live-session endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return { ok: true, status: 200, json: async () => ({ onboardingCompletedAt: new Date().toISOString() }), headers: { get: () => null } } as unknown as Response;
      }
      return { ok: false, status: 501, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<JudyDock userName="Robert" />);

    await screen.findByTestId('avatar-stage-stub');
    const talkButton = await screen.findByRole('button', { name: 'Talk with Judy' });
    expect(screen.queryByText('Go live')).not.toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/avatar/session'),
      expect.anything()
    );
    fireEvent.click(talkButton);

    expect(await screen.findByRole('status')).toHaveTextContent('Listening');
    expect(screen.getByRole('button', { name: 'End conversation' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/avatar/session'),
      expect.anything()
    );
  });

  it('shows interim browser recognition and Stop preserves editable text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          onboardingCompletedAt: new Date().toISOString(),
          spokenLanguage: 'es-MX',
        }),
      }) as Response)
    );

    render(<JudyDock userName="Robert" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Talk with Judy' }));

    await waitFor(() => expect(recognitionMock.start).toHaveBeenCalled());
    expect(recognitionMock.options?.language).toBe('es-MX');
    act(() => recognitionMock.options?.onInterim('Necesito un hotel'));
    expect(screen.getByText('Necesito un hotel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }));
    expect(recognitionMock.stop).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Correct what Judy heard')).toHaveValue(
      'Necesito un hotel'
    );
  });

  it('submits finalized speech immediately without an approval gate', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            onboardingCompletedAt: new Date().toISOString(),
            spokenLanguage: 'en-US',
          }),
        headers: { get: () => null } } as unknown as Response;
      }
      if (url.includes('/api/avatar/chat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ reply: 'I can help with that.' }),
        headers: { get: () => null } } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<JudyDock userName="Robert" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Talk with Judy' }));
    await waitFor(() => expect(recognitionMock.start).toHaveBeenCalled());
    act(() => recognitionMock.options?.onFinal('Help me plan Madrid'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/avatar/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Help me plan Madrid'),
        })
      )
    );
    const chatCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/api/avatar/chat')
    );
    const chatBody = JSON.parse(
      String((chatCall?.[1] as RequestInit | undefined)?.body ?? '{}')
    );
    expect(chatBody.history).toEqual([
      expect.objectContaining({ role: 'assistant' }),
    ]);
    expect(chatBody.history).not.toContainEqual(
      expect.objectContaining({ text: 'Help me plan Madrid' })
    );
    expect(screen.queryByLabelText('Correct what Judy heard')).not.toBeInTheDocument();
  });

  it('switches to the server-backed Scribe fallback after a native service failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          onboardingCompletedAt: new Date().toISOString(),
          spokenLanguage: 'fr-FR',
        }),
      }) as Response)
    );

    render(<JudyDock userName="Robert" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Talk with Judy' }));
    await waitFor(() => expect(recognitionMock.start).toHaveBeenCalled());

    act(() =>
      recognitionMock.options?.onFailure(
        'service-failed',
        'Voice recognition service is unavailable.'
      )
    );

    await waitFor(() => expect(scribeFallbackMock.start).toHaveBeenCalled());
    expect(scribeFallbackMock.options?.languageCode).toBe('fr-FR');
    expect(screen.getByRole('status')).toHaveTextContent('Listening');
  });
});

describe('JudyDock caption overlay (Swarm J6)', () => {
  it('shows a live caption of the reply even when the chat panel is closed', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return { ok: true, status: 200, json: async () => ({ onboardingCompletedAt: new Date().toISOString() }), headers: { get: () => null } } as unknown as Response;
      }
      if (url.includes('/api/avatar/chat')) {
        return { ok: true, status: 200, json: async () => ({ reply: 'Pack a raincoat, friend!' }), headers: { get: () => null } } as unknown as Response;
      }
      return { ok: false, status: 501, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<JudyDock userName="Robert" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Type instead' }));
    const input = await screen.findByPlaceholderText('Ask Judy Pierre anything...');
    fireEvent.change(input, { target: { value: 'What should I pack?' } });
    fireEvent.click(screen.getByTitle('Send message'));

    // The reply is now in transcript AND, while the avatar is "talking",
    // mirrored as an on-screen caption — the transcript alone isn't enough
    // once the chat panel is collapsed.
    await waitFor(() => {
      const caption = document.querySelector('.judy-speech-caption');
      expect(caption).not.toBeNull();
      expect(within(caption as HTMLElement).getByText('Pack a raincoat, friend!')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    const caption = document.querySelector('.judy-speech-caption');
    expect(caption).not.toBeNull();
    expect(within(caption as HTMLElement).getByText('Pack a raincoat, friend!')).toBeInTheDocument();
  });
});

describe('JudyDock synchronized local speech', () => {
  it('starts no audio on mount, then speaks the welcome and keeps the microphone off until it ends', async () => {
    const audioInstances: MockAudio[] = [];
    class MockAudio {
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      play = vi.fn(async () => undefined);

      constructor(readonly src: string) {
        audioInstances.push(this);
      }
    }

    vi.stubGlobal('Audio', MockAudio);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:judy-welcome');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            onboardingCompletedAt: new Date().toISOString(),
            spokenLanguage: 'en-US',
          }),
        headers: { get: () => null } } as unknown as Response;
      }
      if (url.includes('/api/avatar/lipsync')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            audio: window.btoa('welcome wav'),
            mimeType: 'audio/wav',
            cues: [{ start: 0, end: 0.2, value: 'A' }],
          }),
        headers: { get: () => null } } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<JudyDock userName="Robert" />);
    await screen.findByRole('button', { name: 'Talk with Judy' });
    expect(audioInstances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/avatar/lipsync',
      expect.anything()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Talk with Judy' }));
    await waitFor(() => expect(audioInstances).toHaveLength(1));
    expect(screen.getByRole('status')).toHaveTextContent('Judy is getting ready');
    expect(recognitionMock.start).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/avatar/lipsync',
      expect.objectContaining({
        body: expect.stringContaining("Hi, I'm Judy Pierre"),
      })
    );

    act(() => audioInstances[0].onended?.());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Listening'));
    expect(recognitionMock.start).toHaveBeenCalled();
    expect(window.localStorage.getItem('judy-speech-synthesis-enabled')).toBe('true');
  });

  it('uses synchronized speech for active-conversation replies even when the old toggle began off', async () => {
    const audioInstances: MockAudio[] = [];
    class MockAudio {
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      play = vi.fn(async () => undefined);

      constructor(readonly src: string) {
        audioInstances.push(this);
      }
    }

    vi.stubGlobal('Audio', MockAudio);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:judy-active-conversation');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/user/preferences')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ onboardingCompletedAt: new Date().toISOString() }),
          headers: { get: () => null } } as unknown as Response;
        }
        if (url.includes('/api/avatar/chat')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ reply: 'Take a light jacket.' }),
          headers: { get: () => null } } as unknown as Response;
        }
        if (url.includes('/api/avatar/lipsync')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              audio: window.btoa('speech wav'),
              mimeType: 'audio/wav',
              cues: [],
            }),
          headers: { get: () => null } } as unknown as Response;
        }
        return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
      })
    );

    render(<JudyDock userName="Robert" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Talk with Judy' }));
    await waitFor(() => expect(audioInstances).toHaveLength(1));
    act(() => audioInstances[0].onended?.());
    await waitFor(() => expect(recognitionMock.start).toHaveBeenCalled());

    act(() => recognitionMock.options?.onFinal('What should I wear?'));
    await waitFor(() => expect(audioInstances).toHaveLength(2));
  });

  it('pauses listening while an explicitly requested translation speaks, then resumes', async () => {
    const audioInstances: MockAudio[] = [];
    class MockAudio {
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      play = vi.fn(async () => undefined);

      constructor(readonly src: string) {
        audioInstances.push(this);
      }
    }

    vi.stubGlobal('Audio', MockAudio);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:judy-translation');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/user/preferences')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ onboardingCompletedAt: new Date().toISOString() }),
          headers: { get: () => null } } as unknown as Response;
        }
        if (url.includes('/api/hermes/translate')) {
          return {
            ok: true,
            status: 202,
            json: async () => ({
              job_id: 'translate-now',
              status: 'succeeded',
              result: { translated_text: 'Hola, puedo ayudarte con tu viaje.' },
            }),
          headers: { get: () => null } } as unknown as Response;
        }
        if (url.includes('/api/avatar/lipsync')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              audio: window.btoa('translated wav'),
              mimeType: 'audio/wav',
              cues: [],
            }),
          headers: { get: () => null } } as unknown as Response;
        }
        return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
      })
    );

    render(<JudyDock userName="Robert" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Talk with Judy' }));
    await waitFor(() => expect(audioInstances).toHaveLength(1));
    act(() => audioInstances[0].onended?.());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Listening'));
    const startsBeforeTranslation = recognitionMock.start.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    fireEvent.change(await screen.findByLabelText('Translate Judy’s reply'), {
      target: { value: 'es-MX' },
    });
    await screen.findByText('Hola, puedo ayudarte con tu viaje.');
    fireEvent.click(screen.getByRole('button', { name: 'Speak translation' }));

    await waitFor(() => expect(audioInstances).toHaveLength(2));
    expect(screen.getByLabelText('Conversation paused')).toBeInTheDocument();
    expect(recognitionMock.start).toHaveBeenCalledTimes(startsBeforeTranslation);

    act(() => audioInstances[1].onended?.());
    await waitFor(() => expect(screen.getByLabelText('Judy is listening')).toBeInTheDocument());
    expect(recognitionMock.start.mock.calls.length).toBeGreaterThan(startsBeforeTranslation);
  });

  it('plays the exact WAV returned with Rhubarb cues and follows its audio events', async () => {
    window.localStorage.setItem('judy-speech-synthesis-enabled', 'true');

    const audioInstances: MockAudio[] = [];
    class MockAudio {
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      play = vi.fn(async () => undefined);

      constructor(readonly src: string) {
        audioInstances.push(this);
      }
    }

    vi.stubGlobal('Audio', MockAudio);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:judy-voice');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return { ok: true, status: 200, json: async () => ({ onboardingCompletedAt: new Date().toISOString() }), headers: { get: () => null } } as unknown as Response;
      }
      if (url.includes('/api/avatar/chat')) {
        return { ok: true, status: 200, json: async () => ({ reply: 'Your train leaves at noon.' }), headers: { get: () => null } } as unknown as Response;
      }
      if (url.includes('/api/avatar/lipsync')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            audio: window.btoa('exact wav bytes'),
            mimeType: 'audio/wav',
            cues: [{ start: 0, end: 0.2, value: 'A' }],
          }),
        headers: { get: () => null } } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<JudyDock userName="Robert" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Type instead' }));
    fireEvent.change(await screen.findByPlaceholderText('Ask Judy Pierre anything...'), {
      target: { value: 'When does my train leave?' },
    });
    fireEvent.click(screen.getByTitle('Send message'));

    await waitFor(() => expect(audioInstances).toHaveLength(1));
    expect(audioInstances[0].src).toBe('blob:judy-voice');
    expect(audioInstances[0].play).toHaveBeenCalledOnce();
    expect(screen.getByTestId('avatar-stage-stub')).toHaveAttribute('data-talking', 'false');

    act(() => audioInstances[0].onplay?.());
    expect(screen.getByTestId('avatar-stage-stub')).toHaveAttribute('data-talking', 'true');
    expect(screen.getByTestId('avatar-stage-stub')).toHaveAttribute('data-cue-count', '1');

    act(() => audioInstances[0].onended?.());
    expect(screen.getByTestId('avatar-stage-stub')).toHaveAttribute('data-talking', 'false');
    expect(screen.getByTestId('avatar-stage-stub')).toHaveAttribute('data-cue-count', '0');

    window.localStorage.removeItem('judy-speech-synthesis-enabled');
  });

  it('automatically listens again only after synchronized reply audio ends', async () => {
    window.localStorage.setItem('judy-speech-synthesis-enabled', 'true');

    const audioInstances: MockAudio[] = [];
    class MockAudio {
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      play = vi.fn(async () => undefined);

      constructor(readonly src: string) {
        audioInstances.push(this);
      }
    }

    vi.stubGlobal('Audio', MockAudio);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:judy-conversation');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/user/preferences')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              onboardingCompletedAt: new Date().toISOString(),
              spokenLanguage: 'en-US',
            }),
          headers: { get: () => null } } as unknown as Response;
        }
        if (url.includes('/api/avatar/chat')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ reply: 'Take the morning train.' }),
          headers: { get: () => null } } as unknown as Response;
        }
        if (url.includes('/api/avatar/lipsync')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              audio: window.btoa('conversation wav'),
              mimeType: 'audio/wav',
              cues: [{ start: 0, end: 0.2, value: 'B' }],
            }),
          headers: { get: () => null } } as unknown as Response;
        }
        return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } } as unknown as Response;
      })
    );

    render(<JudyDock userName="Robert" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Talk with Judy' }));
    await waitFor(() => expect(audioInstances).toHaveLength(1));
    act(() => audioInstances[0].onended?.());
    await waitFor(() => expect(recognitionMock.start).toHaveBeenCalled());
    const startsBeforeReply = recognitionMock.start.mock.calls.length;

    act(() => recognitionMock.options?.onFinal('Which train should I take?'));
    await waitFor(() => expect(audioInstances).toHaveLength(2));
    expect(screen.getByRole('status')).toHaveTextContent('Judy is speaking');
    expect(recognitionMock.start).toHaveBeenCalledTimes(startsBeforeReply);

    act(() => audioInstances[1].onended?.());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Listening'));
    expect(recognitionMock.start.mock.calls.length).toBeGreaterThan(startsBeforeReply);
  });
});
