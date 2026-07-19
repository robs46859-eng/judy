// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hermesMock = vi.hoisted(() => ({
  submit: vi.fn(async () => null as unknown),
  result: null as unknown,
  error: null as string | null,
  status: 'idle',
  isBusy: false,
}));

vi.mock('@/lib/hermes/useHermesJob', () => ({
  useHermesJob: () => ({ ...hermesMock, reset: vi.fn() }),
}));

import ReplyActions from '../ReplyActions';

beforeEach(() => {
  hermesMock.submit.mockClear();
  hermesMock.result = null;
  hermesMock.error = null;
  hermesMock.status = 'idle';
  hermesMock.isBusy = false;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReplyActions', () => {
  it('copies the original Judy reply and confirms success', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<ReplyActions originalText="Pack a raincoat." onSpeak={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy reply' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Pack a raincoat.'));
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('shows a visible failure when clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    render(<ReplyActions originalText="Pack a raincoat." onSpeak={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy reply' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Copy is unavailable in this browser.'
    );
  });

  it('does not translate until a language is selected, then uses the Hermes queue', async () => {
    render(
      <ReplyActions
        originalText="Pack a raincoat."
        originalLanguage="en-US"
        onSpeak={vi.fn()}
      />
    );

    expect(hermesMock.submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Translate Judy’s reply'), {
      target: { value: 'es-MX' },
    });

    expect(hermesMock.submit).toHaveBeenCalledWith({
      input: 'Pack a raincoat.',
      source_language: 'English',
      target_language: 'Spanish',
    });
  });

  it('keeps the original visible and speaks a completed translation only on explicit click', async () => {
    hermesMock.result = { translated_text: 'Lleva un impermeable.' };
    const onSpeak = vi.fn(async () => {});
    render(
      <ReplyActions
        originalText="Pack a raincoat."
        originalLanguage="en-US"
        onSpeak={onSpeak}
      />
    );

    fireEvent.change(screen.getByLabelText('Translate Judy’s reply'), {
      target: { value: 'es-MX' },
    });
    expect(screen.getByText('Pack a raincoat.')).toBeInTheDocument();
    expect(screen.getByText('Lleva un impermeable.')).toBeInTheDocument();
    expect(onSpeak).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speak translation' }));
    await waitFor(() =>
      expect(onSpeak).toHaveBeenCalledWith('Lleva un impermeable.', 'es-MX')
    );
  });

  it('disables Speak translation until translation succeeds', () => {
    render(<ReplyActions originalText="Pack a raincoat." onSpeak={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Speak translation' })).toBeDisabled();
  });
});
