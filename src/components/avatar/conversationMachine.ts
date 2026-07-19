export type ConversationPhase =
  | 'idle'
  | 'welcoming'
  | 'listening'
  | 'editing'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'error';

export interface ConversationState {
  phase: ConversationPhase;
  sessionActive: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
}

export type ConversationEvent =
  | { type: 'START' }
  | { type: 'WELCOME_FINISHED' }
  | { type: 'INTERIM'; text: string }
  | { type: 'COMMIT'; text: string }
  | { type: 'STOP_LISTENING' }
  | { type: 'EDIT'; text: string }
  | { type: 'SUBMIT' }
  | { type: 'REPLY_READY' }
  | { type: 'SPEECH_FINISHED' }
  | { type: 'RESUME' }
  | { type: 'END' }
  | { type: 'FAIL'; message: string };

export const INITIAL_CONVERSATION_STATE: ConversationState = {
  phase: 'idle',
  sessionActive: false,
  interimTranscript: '',
  finalTranscript: '',
  error: null,
};

export function conversationReducer(
  state: ConversationState,
  event: ConversationEvent
): ConversationState {
  switch (event.type) {
    case 'START':
      return {
        ...INITIAL_CONVERSATION_STATE,
        phase: 'welcoming',
        sessionActive: true,
      };
    case 'WELCOME_FINISHED':
      return state.phase === 'welcoming' ? { ...state, phase: 'listening' } : state;
    case 'INTERIM':
      return state.phase === 'listening'
        ? { ...state, interimTranscript: event.text, error: null }
        : state;
    case 'COMMIT': {
      const text = event.text.trim();
      return state.phase === 'listening' && text
        ? {
            ...state,
            phase: 'thinking',
            interimTranscript: '',
            finalTranscript: text,
            error: null,
          }
        : state;
    }
    case 'STOP_LISTENING':
      return state.phase === 'listening'
        ? {
            ...state,
            phase: 'editing',
            interimTranscript: '',
            finalTranscript: state.interimTranscript || state.finalTranscript,
          }
        : state;
    case 'EDIT':
      return state.phase === 'editing' ? { ...state, finalTranscript: event.text } : state;
    case 'SUBMIT':
      return state.phase === 'editing' && state.finalTranscript.trim()
        ? { ...state, phase: 'thinking', error: null }
        : state;
    case 'REPLY_READY':
      return state.phase === 'thinking' ? { ...state, phase: 'speaking' } : state;
    case 'SPEECH_FINISHED':
      return state.phase === 'speaking'
        ? {
            ...state,
            phase: state.sessionActive ? 'listening' : 'idle',
            interimTranscript: '',
            finalTranscript: '',
            error: null,
          }
        : state;
    case 'RESUME':
      return state.sessionActive && ['editing', 'paused', 'error'].includes(state.phase)
        ? {
            ...state,
            phase: 'listening',
            interimTranscript: '',
            finalTranscript: '',
            error: null,
          }
        : state;
    case 'END':
      return INITIAL_CONVERSATION_STATE;
    case 'FAIL':
      return {
        ...state,
        phase: 'error',
        error: event.message,
      };
    default:
      return state;
  }
}
