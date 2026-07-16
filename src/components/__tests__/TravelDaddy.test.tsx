// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TravelDaddy from '../TravelDaddy';

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

// AvatarStage wraps a real @react-three/fiber <Canvas>, which needs a real
// WebGL context — meaningless (and unsupported) in jsdom. Stub it so these
// tests exercise TravelDaddy's own primary/fallback logic, not Three.js.
// `avatarStageMock.shouldFail` lets a test simulate AvatarStage's
// onUnavailable callback (a failed GLTF load / no WebGL) the same way the
// real component's error boundary would report it.
const avatarStageMock = vi.hoisted(() => ({ shouldFail: false }));
vi.mock('../avatar/AvatarStage', () => ({
  default: ({ onUnavailable }: { onUnavailable?: () => void }) => {
    if (avatarStageMock.shouldFail) {
      setTimeout(() => onUnavailable?.(), 0);
    }
    return <div data-testid="avatar-stage-stub" />;
  },
}));

const AVATAR_ALT = "Travel Daddy, Judy's travel translator and guide";

beforeEach(() => {
  avatarStageMock.shouldFail = false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TravelDaddy avatar fallback (Swarm J7)', () => {
  it('shows the rigged GLB avatar by default — the flat portrait is not the everyday avatar anymore', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 501, json: async () => ({}) }) as Response)
    );

    render(<TravelDaddy userName="Robert" />);

    expect(await screen.findByTestId('avatar-stage-stub')).toBeInTheDocument();
    expect(screen.queryByAltText(AVATAR_ALT)).not.toBeInTheDocument();

    // Chat + translation entry points must still be usable regardless of avatar mode.
    expect(screen.getByTitle('Chat with Travel Daddy')).toBeInTheDocument();
    expect(screen.getByTitle('Translate a phrase')).toBeInTheDocument();
  });

  it('shows the GLB avatar even when the HeyGen session request errors outright', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unavailable');
      })
    );

    render(<TravelDaddy userName="Robert" />);

    await waitFor(() => expect(screen.getByTestId('avatar-stage-stub')).toBeInTheDocument());
    // The live video element stays hidden — it's never displayed without a
    // live session, so the GLB/text/translation stay usable.
    const video = document.querySelector('video');
    expect(video).toHaveStyle({ display: 'none' });
  });

  it('falls back to the static robjudy.jpg portrait when the GLB avatar reports it cannot render', async () => {
    avatarStageMock.shouldFail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 501, json: async () => ({}) }) as Response)
    );

    render(<TravelDaddy userName="Robert" />);

    const avatarImg = await screen.findByAltText(AVATAR_ALT);
    expect(avatarImg).toHaveAttribute('src', '/avatars/robjudy.jpg');
    expect(screen.queryByTestId('avatar-stage-stub')).not.toBeInTheDocument();
  });
});

describe('TravelDaddy live session opt-in gate (Swarm J5)', () => {
  it('never calls /api/avatar/session on mount — the live session requires an explicit "Go live" click', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return { ok: true, status: 200, json: async () => ({ onboardingCompletedAt: new Date().toISOString() }) } as Response;
      }
      return { ok: false, status: 501, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TravelDaddy userName="Robert" />);

    await screen.findByTestId('avatar-stage-stub');
    await screen.findByTitle('Start the live avatar');

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/avatar/session'),
      expect.anything()
    );
  });

  it('only requests a live session after the person clicks "Go live"', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return { ok: true, status: 200, json: async () => ({ onboardingCompletedAt: new Date().toISOString() }) } as Response;
      }
      if (url.includes('/api/avatar/session')) {
        return { ok: false, status: 501, json: async () => ({}) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TravelDaddy userName="Robert" />);

    const goLiveBtn = await screen.findByTitle('Start the live avatar');
    fireEvent.click(goLiveBtn);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/avatar/session'),
        expect.anything()
      )
    );
  });
});

describe('TravelDaddy caption overlay (Swarm J6)', () => {
  it('shows a live caption of the reply even when the chat panel is closed', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/user/preferences')) {
        return { ok: true, status: 200, json: async () => ({ onboardingCompletedAt: new Date().toISOString() }) } as Response;
      }
      if (url.includes('/api/avatar/chat')) {
        return { ok: true, status: 200, json: async () => ({ reply: 'Pack a raincoat, friend!' }) } as Response;
      }
      return { ok: false, status: 501, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TravelDaddy userName="Robert" />);

    fireEvent.click(await screen.findByTitle('Chat with Travel Daddy'));
    const input = await screen.findByPlaceholderText('Ask Travel Daddy anything...');
    fireEvent.change(input, { target: { value: 'What should I pack?' } });
    fireEvent.click(screen.getByTitle('Send message'));

    // The reply is now in transcript AND, while the avatar is "talking",
    // mirrored as an on-screen caption — the transcript alone isn't enough
    // once the chat panel is collapsed.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Pack a raincoat, friend!')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    expect(screen.getByRole('status')).toHaveTextContent('Pack a raincoat, friend!');
  });
});
