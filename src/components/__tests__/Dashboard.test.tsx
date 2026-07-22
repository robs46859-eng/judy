// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Dashboard from '../Dashboard';

// The avatar/chat/translation experience is JudyDock's own concern
// (covered separately in JudyDock.test.tsx). Stub it here so Dashboard
// tests focus on the shell and home-screen composition.
vi.mock('../JudyDock', () => ({
  default: ({ avatarModelUrl }: { avatarModelUrl?: string }) => (
    <div data-testid="judy-dock-stub" data-model-url={avatarModelUrl}>
      Judy Pierre
    </div>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

const signOutMock = vi.fn();
vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip-1',
    name: 'Trip to Lisbon',
    destinationName: 'Lisbon',
    destinationLat: 38.7,
    destinationLng: -9.1,
    departureDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    returnDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    totalBudget: 1000,
    airfareCost: 300,
    hotelCost: 400,
    spendingBudget: 300,
    budgetItems: [],
    itineraryItems: [{ id: 'item-1', title: 'Arrive', time: '09:00' }],
    ...overrides,
  };
}

describe('Dashboard', () => {
  beforeEach(() => {
    signOutMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not render the old top greeting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([]))
    );

    render(<Dashboard userName="Robert" userEmail="robs46859@gmail.com" />);

    await waitFor(() => expect(screen.getByTestId('judy-dock-stub')).toBeInTheDocument());

    expect(screen.queryByText(/be gay while away/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hello, Robert/i)).not.toBeInTheDocument();
  });

  it('keeps the logo, top action controls, primary navigation, and compact Judy toolbar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([]))
    );

    render(<Dashboard userName="Robert" userEmail="robs46859@gmail.com" />);
    await waitFor(() => expect(screen.getByTestId('judy-dock-stub')).toBeInTheDocument());

    expect(screen.getByAltText('Judy')).toBeInTheDocument();
    expect(screen.getByTitle('Profile')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle Theme')).toBeInTheDocument();
    expect(screen.getByTitle('Sign Out')).toBeInTheDocument();
    expect(screen.getByLabelText('Trip context toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Judy Pierre status')).toHaveTextContent('Judy Pierre is ready');

    for (const label of ['Dashboard', 'Itinerary', 'Trip Viewer', 'Budget', 'Contact', 'Settings']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows the Avatar Manager only to admins and forwards the active model URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])));

    const { rerender } = render(
      <Dashboard
        userName="Robert"
        userEmail="owner@example.com"
        avatarAdmin
        avatarModelUrl="/api/avatar/model?v=abc123"
      />
    );

    expect(await screen.findByRole('link', { name: 'Open Avatar Manager' })).toHaveAttribute(
      'href',
      '/admin/avatar'
    );
    expect(screen.getByTestId('judy-dock-stub')).toHaveAttribute(
      'data-model-url',
      '/api/avatar/model?v=abc123'
    );

    rerender(<Dashboard userName="Robert" userEmail="traveler@example.com" />);
    expect(screen.queryByRole('link', { name: 'Open Avatar Manager' })).not.toBeInTheDocument();
  });

  it('focused home shows only the avatar, countdown, and weather widgets', async () => {
    const trip = makeTrip();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('/api/trips')) return jsonResponse([trip]);
        if (url.startsWith('/api/weather')) {
          return jsonResponse({ current: { temperature: { degrees: 70 } }, daysUntilDeparture: 5 });
        }
        return jsonResponse({});
      })
    );

    render(<Dashboard userName="Robert" userEmail="robs46859@gmail.com" />);
    await waitFor(() => expect(screen.getByTestId('judy-dock-stub')).toBeInTheDocument());
    // Destination context belongs to the compact toolbar once the trip loads.
    await waitFor(() => expect(screen.getAllByText('Lisbon').length).toBeGreaterThan(0));

    expect(screen.getByText('Trip Countdown')).toBeInTheDocument();
    expect(screen.getByText('Weather')).toBeInTheDocument();

    expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
    expect(screen.queryByText('Next Up')).not.toBeInTheDocument();
    expect(screen.queryByText('Budget Overview')).not.toBeInTheDocument();
  });

  it('shows a stable, neutral empty state when there is no trip', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([]))
    );

    render(<Dashboard userName="Robert" userEmail="robs46859@gmail.com" />);
    await waitFor(() => expect(screen.getByTestId('judy-dock-stub')).toBeInTheDocument());

    expect(await screen.findByText(/no upcoming trip yet/i)).toBeInTheDocument();
    expect(screen.getByText('Trip Countdown')).toBeInTheDocument();
    expect(screen.getByText(/add a trip to see weather/i)).toBeInTheDocument();
    expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
  });

  it('shows a weather error state without collapsing the widget when the fetch fails', async () => {
    const trip = makeTrip();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('/api/trips')) return jsonResponse([trip]);
        if (url.startsWith('/api/weather')) throw new Error('network down');
        return jsonResponse({});
      })
    );

    render(<Dashboard userName="Robert" userEmail="robs46859@gmail.com" />);
    await waitFor(() => expect(screen.getAllByText('Lisbon').length).toBeGreaterThan(0));

    expect(await screen.findByText('Weather unavailable')).toBeInTheDocument();
    expect(screen.getByText('Weather')).toBeInTheDocument();
  });

  it('J6: left nav items are real, keyboard-reachable buttons, not click-only divs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([]))
    );

    render(<Dashboard userName="Robert" userEmail="robs46859@gmail.com" />);
    await waitFor(() => expect(screen.getByTestId('judy-dock-stub')).toBeInTheDocument());

    const dashboardNavBtn = screen.getByRole('button', { name: 'Dashboard' });
    const settingsNavBtn = screen.getByRole('button', { name: 'Settings' });
    expect(dashboardNavBtn).toHaveAttribute('aria-current', 'page');
    expect(settingsNavBtn).not.toHaveAttribute('aria-current');

    fireEvent.click(settingsNavBtn);

    expect(await screen.findByText('Judy Pierre voice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });
});
