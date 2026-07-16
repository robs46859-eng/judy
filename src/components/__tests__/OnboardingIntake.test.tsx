// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OnboardingIntake from '../OnboardingIntake';

const USER_EMAIL = 'robs46859@gmail.com';

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

async function answer(text: string) {
  const input = screen.getByPlaceholderText('Type your answer…');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByTitle('Send answer'));
}

// Some Node versions ship a built-in global `localStorage` that jsdom won't
// override, and it's non-functional without `--localstorage-file` pointed
// at a real path (that's the Node warning this setup prints). Rather than
// depend on whichever implementation the runtime happens to pick, install a
// real in-memory Storage for every test.
function installMemoryStorage() {
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OnboardingIntake', () => {
  it('opens with the fixed deterministic greeting, not an LLM-generated one', () => {
    render(<OnboardingIntake userEmail={USER_EMAIL} onDone={vi.fn()} />);
    expect(
      screen.getByText(/what is your native language/i)
    ).toBeInTheDocument();
  });

  it('walks through all five questions and reaches an editable summary', async () => {
    render(<OnboardingIntake userEmail={USER_EMAIL} onDone={vi.fn()} />);

    await answer('English');
    await answer('Spanish');
    await answer('NYC to Madrid');
    fireEvent.click(screen.getByTitle('Skip this question')); // pre-travel tasks
    await answer('Booking recommendations');

    expect(await screen.findByText(/anything to change before I save it/i)).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument(); // pre-travel tasks was skipped
  });

  it('never saves anything until Confirm is pressed, and only the confirmed answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));
    render(<OnboardingIntake userEmail={USER_EMAIL} onDone={vi.fn()} />);

    await answer('English');
    await answer('Spanish');
    await answer('NYC to Madrid');
    await answer('Renew passport');
    await answer('Booking recommendations');

    await screen.findByText(/anything to change before I save it/i);
    // No network call yet — reaching the summary must not itself persist anything.
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Confirm and save'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/user/preferences');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body.completeOnboarding).toBe(true);
    expect(body.nativeLanguage).toBe('English');
  });

  it('calls onDone after a successful save and clears the local draft', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));
    const onDone = vi.fn();
    render(<OnboardingIntake userEmail={USER_EMAIL} onDone={onDone} />);

    for (const value of ['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']) {
      await answer(value);
    }
    await screen.findByText(/anything to change before I save it/i);
    fireEvent.click(screen.getByTitle('Confirm and save'));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(`judy-onboarding-draft:${USER_EMAIL}`)).toBeNull();
  });

  it('shows a retryable error and keeps answers when the save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Could not save preferences.' }, false))
    );
    const onDone = vi.fn();
    render(<OnboardingIntake userEmail={USER_EMAIL} onDone={onDone} />);

    for (const value of ['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']) {
      await answer(value);
    }
    await screen.findByText(/anything to change before I save it/i);
    fireEvent.click(screen.getByTitle('Confirm and save'));

    expect(await screen.findByText('Could not save preferences.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    // The answer is still there for a retry — nothing was thrown away.
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('resumes an in-progress draft from localStorage instead of restarting', () => {
    window.localStorage.setItem(
      `judy-onboarding-draft:${USER_EMAIL}`,
      JSON.stringify({
        stepIndex: 2,
        answers: { nativeLanguage: 'English', translationLanguage: 'Spanish' },
        skipped: {},
        phase: 'asking',
      })
    );

    render(<OnboardingIntake userEmail={USER_EMAIL} onDone={vi.fn()} />);

    // Resumed at question 3 (travelRoute) — not restarted from question 1.
    expect(screen.getByText(/traveling from, and where are you headed/i)).toBeInTheDocument();
    // The prior two answers carried over into the transcript.
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Spanish')).toBeInTheDocument();
    // Not waiting on a fresh answer to the first question anymore.
    expect(screen.queryByPlaceholderText('Type your answer…')).toBeInTheDocument();
    expect(screen.getByText(/translate to and from most often/i)).toBeInTheDocument();
  });
});
