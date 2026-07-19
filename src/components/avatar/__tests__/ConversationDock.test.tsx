// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConversationDock from '../ConversationDock';
import {
  INITIAL_CONVERSATION_STATE,
  type ConversationState,
} from '../conversationMachine';

afterEach(cleanup);

function callbacks() {
  return {
    onStart: vi.fn(),
    onStopListening: vi.fn(),
    onTranscriptChange: vi.fn(),
    onSubmit: vi.fn(),
    onResume: vi.fn(),
    onEnd: vi.fn(),
    onTypeInstead: vi.fn(),
  };
}

function state(overrides: Partial<ConversationState>): ConversationState {
  return { ...INITIAL_CONVERSATION_STATE, ...overrides };
}

describe('ConversationDock', () => {
  it('makes the primary action and purpose obvious while idle', () => {
    const handlers = callbacks();
    render(<ConversationDock state={INITIAL_CONVERSATION_STATE} {...handlers} />);

    fireEvent.click(screen.getByRole('button', { name: 'Talk with Judy' }));
    expect(handlers.onStart).toHaveBeenCalledOnce();
    expect(
      screen.getByText(/Judy will speak, listen, and help with your trip/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type instead' })).toBeInTheDocument();
  });

  it('shows live transcription with Stop and End conversation while listening', () => {
    const handlers = callbacks();
    render(
      <ConversationDock
        state={state({
          phase: 'listening',
          sessionActive: true,
          interimTranscript: 'Where should I stay',
        })}
        {...handlers}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Listening');
    expect(screen.getByText('Where should I stay')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }));
    fireEvent.click(screen.getByRole('button', { name: 'End conversation' }));
    expect(handlers.onStopListening).toHaveBeenCalledOnce();
    expect(handlers.onEnd).toHaveBeenCalledOnce();
  });

  it('lets the traveler correct stopped speech and send or resume', () => {
    const handlers = callbacks();
    render(
      <ConversationDock
        state={state({
          phase: 'editing',
          sessionActive: true,
          finalTranscript: 'Book a table for too',
        })}
        {...handlers}
      />
    );

    const transcript = screen.getByRole('textbox', { name: 'Correct what Judy heard' });
    fireEvent.change(transcript, { target: { value: 'Book a table for two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send corrected transcript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume listening' }));

    expect(handlers.onTranscriptChange).toHaveBeenCalledWith('Book a table for two');
    expect(handlers.onSubmit).toHaveBeenCalledOnce();
    expect(handlers.onResume).toHaveBeenCalledOnce();
  });

  it.each([
    ['welcoming', 'Judy is getting ready'],
    ['thinking', 'Judy is thinking'],
    ['speaking', 'Judy is speaking'],
    ['paused', 'Conversation paused'],
  ] as const)('announces the %s phase', (phase, label) => {
    render(
      <ConversationDock
        state={state({ phase, sessionActive: true })}
        {...callbacks()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(label);
  });

  it('shows an actionable error with typed and resume fallbacks', () => {
    const handlers = callbacks();
    render(
      <ConversationDock
        state={state({
          phase: 'error',
          sessionActive: true,
          error: 'Microphone permission was denied.',
        })}
        {...handlers}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Microphone permission was denied.');
    expect(screen.getByRole('button', { name: 'Resume listening' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type instead' })).toBeInTheDocument();
  });
});
