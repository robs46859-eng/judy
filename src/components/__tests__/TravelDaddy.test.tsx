// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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
