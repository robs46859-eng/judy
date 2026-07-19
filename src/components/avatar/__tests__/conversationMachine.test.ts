import { describe, expect, it } from 'vitest';
import {
  INITIAL_CONVERSATION_STATE,
  conversationReducer,
} from '../conversationMachine';

describe('conversationReducer', () => {
  it('starts with a spoken welcome before listening', () => {
    const started = conversationReducer(INITIAL_CONVERSATION_STATE, { type: 'START' });

    expect(started).toMatchObject({
      phase: 'welcoming',
      sessionActive: true,
      interimTranscript: '',
      finalTranscript: '',
      error: null,
    });

    expect(conversationReducer(started, { type: 'WELCOME_FINISHED' }).phase).toBe(
      'listening'
    );
  });

  it('shows interim speech and commits finalized speech for submission', () => {
    const listening = {
      ...INITIAL_CONVERSATION_STATE,
      phase: 'listening' as const,
      sessionActive: true,
    };
    const interim = conversationReducer(listening, {
      type: 'INTERIM',
      text: 'Where should I',
    });
    const committed = conversationReducer(interim, {
      type: 'COMMIT',
      text: 'Where should I stay in Madrid?',
    });

    expect(interim.interimTranscript).toBe('Where should I');
    expect(committed).toMatchObject({
      phase: 'thinking',
      interimTranscript: '',
      finalTranscript: 'Where should I stay in Madrid?',
    });
  });

  it('stops automatic submission and preserves speech for editing', () => {
    const listening = {
      ...INITIAL_CONVERSATION_STATE,
      phase: 'listening' as const,
      sessionActive: true,
      interimTranscript: 'Book a table for',
    };

    const editing = conversationReducer(listening, { type: 'STOP_LISTENING' });
    const corrected = conversationReducer(editing, {
      type: 'EDIT',
      text: 'Book a table for two',
    });
    const submitted = conversationReducer(corrected, { type: 'SUBMIT' });

    expect(editing).toMatchObject({
      phase: 'editing',
      interimTranscript: '',
      finalTranscript: 'Book a table for',
    });
    expect(corrected.finalTranscript).toBe('Book a table for two');
    expect(submitted.phase).toBe('thinking');
  });

  it('returns to listening after Judy finishes speaking', () => {
    const thinking = {
      ...INITIAL_CONVERSATION_STATE,
      phase: 'thinking' as const,
      sessionActive: true,
      finalTranscript: 'What is nearby?',
    };
    const speaking = conversationReducer(thinking, { type: 'REPLY_READY' });
    const listening = conversationReducer(speaking, { type: 'SPEECH_FINISHED' });

    expect(speaking.phase).toBe('speaking');
    expect(listening).toMatchObject({
      phase: 'listening',
      sessionActive: true,
      interimTranscript: '',
      finalTranscript: '',
    });
  });

  it('ends from any phase and clears transcripts and errors', () => {
    const failed = {
      phase: 'error' as const,
      sessionActive: true,
      interimTranscript: 'partial',
      finalTranscript: 'final',
      error: 'Microphone unavailable',
    };

    expect(conversationReducer(failed, { type: 'END' })).toEqual(
      INITIAL_CONVERSATION_STATE
    );
  });

  it('ignores empty commits and phase-invalid events', () => {
    const listening = {
      ...INITIAL_CONVERSATION_STATE,
      phase: 'listening' as const,
      sessionActive: true,
    };

    expect(conversationReducer(listening, { type: 'COMMIT', text: '   ' })).toEqual(
      listening
    );
    expect(
      conversationReducer(INITIAL_CONVERSATION_STATE, {
        type: 'INTERIM',
        text: 'ignored',
      })
    ).toEqual(INITIAL_CONVERSATION_STATE);
  });
});
