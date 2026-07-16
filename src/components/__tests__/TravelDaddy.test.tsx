// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TravelDaddy from '../TravelDaddy';

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const AVATAR_ALT = "Travel Daddy, Judy's travel translator and guide";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TravelDaddy avatar fallback', () => {
  it('shows the static robjudy.jpg portrait when the live HeyGen session is not configured (501)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 501, json: async () => ({}) }) as Response)
    );

    render(<TravelDaddy userName="Robert" />);

    const avatarImg = await screen.findByAltText(AVATAR_ALT);
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', '/avatars/robjudy.jpg');

    // Chat + translation entry points must still be usable from the fallback.
    expect(screen.getByTitle('Chat with Travel Daddy')).toBeInTheDocument();
    expect(screen.getByTitle('Translate a phrase')).toBeInTheDocument();
  });

  it('falls back to the static portrait when the live session request errors outright', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unavailable');
      })
    );

    render(<TravelDaddy userName="Robert" />);

    await waitFor(() => expect(screen.getByAltText(AVATAR_ALT)).toBeInTheDocument());
    // The live video element stays hidden — it's never displayed without a
    // live session, so the static avatar/text/translation stay usable.
    const video = document.querySelector('video');
    expect(video).toHaveStyle({ display: 'none' });
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

    await screen.findByAltText(AVATAR_ALT);
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
