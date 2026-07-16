/**
 * Deterministic onboarding intake state machine (Swarm J3).
 *
 * Deliberately NOT LLM-driven: the sequence of questions, what counts as
 * "done", and what gets saved are all fixed ahead of time. A model may help
 * phrase things elsewhere, but it never decides state transitions here and
 * it never writes directly to Prisma — only a user hitting Confirm does,
 * through the whitelisted PATCH /api/user/preferences route.
 */

export type OnboardingFieldKey =
  | 'nativeLanguage'
  | 'translationLanguage'
  | 'travelRoute'
  | 'preTravelTasks'
  | 'helpPreference';

export interface OnboardingStepDef {
  key: OnboardingFieldKey;
  prompt: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    key: 'nativeLanguage',
    prompt:
      "Hi, I'm your travel translator and guide. Before we begin, what is your native language?",
  },
  {
    key: 'translationLanguage',
    prompt: 'Great — which language would you like me to translate to and from most often?',
  },
  {
    key: 'travelRoute',
    prompt: 'Where are you traveling from, and where are you headed?',
  },
  {
    key: 'preTravelTasks',
    prompt: 'Anything to handle before you travel — documents, packing, bookings?',
  },
  {
    key: 'helpPreference',
    prompt: 'Last one — how can I help you most while you travel?',
  },
] as const;

export type OnboardingPhase = 'asking' | 'summary' | 'done';

export interface OnboardingState {
  stepIndex: number;
  answers: Partial<Record<OnboardingFieldKey, string>>;
  skipped: Partial<Record<OnboardingFieldKey, boolean>>;
  phase: OnboardingPhase;
  /** Set while the summary screen has a specific field open for editing. */
  editingKey: OnboardingFieldKey | null;
}

export const initialOnboardingState: OnboardingState = {
  stepIndex: 0,
  answers: {},
  skipped: {},
  phase: 'asking',
  editingKey: null,
};

export type OnboardingAction =
  | { type: 'ANSWER'; value: string }
  | { type: 'SKIP' }
  | { type: 'BACK' }
  | { type: 'EDIT'; key: OnboardingFieldKey }
  | { type: 'RESTART' }
  | { type: 'CONFIRM' };

export function currentStep(state: OnboardingState): OnboardingStepDef | null {
  if (state.phase !== 'asking') return null;
  return ONBOARDING_STEPS[state.stepIndex] ?? null;
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case 'ANSWER': {
      // Editing a specific field from the summary screen.
      if (state.phase === 'summary' && state.editingKey) {
        const key = state.editingKey;
        return {
          ...state,
          answers: { ...state.answers, [key]: action.value },
          skipped: { ...state.skipped, [key]: false },
          editingKey: null,
        };
      }
      if (state.phase !== 'asking') return state;

      const key = ONBOARDING_STEPS[state.stepIndex].key;
      const nextIndex = state.stepIndex + 1;
      const done = nextIndex >= ONBOARDING_STEPS.length;
      return {
        ...state,
        answers: { ...state.answers, [key]: action.value },
        skipped: { ...state.skipped, [key]: false },
        stepIndex: done ? state.stepIndex : nextIndex,
        phase: done ? 'summary' : 'asking',
      };
    }

    case 'SKIP': {
      if (state.phase === 'summary' && state.editingKey) {
        const key = state.editingKey;
        return {
          ...state,
          answers: { ...state.answers, [key]: undefined },
          skipped: { ...state.skipped, [key]: true },
          editingKey: null,
        };
      }
      if (state.phase !== 'asking') return state;

      const key = ONBOARDING_STEPS[state.stepIndex].key;
      const nextIndex = state.stepIndex + 1;
      const done = nextIndex >= ONBOARDING_STEPS.length;
      return {
        ...state,
        answers: { ...state.answers, [key]: undefined },
        skipped: { ...state.skipped, [key]: true },
        stepIndex: done ? state.stepIndex : nextIndex,
        phase: done ? 'summary' : 'asking',
      };
    }

    case 'BACK': {
      if (state.phase === 'summary') {
        // Leaving the summary via Back re-opens the last question.
        return {
          ...state,
          phase: 'asking',
          stepIndex: ONBOARDING_STEPS.length - 1,
          editingKey: null,
        };
      }
      if (state.phase !== 'asking' || state.stepIndex === 0) return state;
      return { ...state, stepIndex: state.stepIndex - 1 };
    }

    case 'EDIT': {
      if (state.phase !== 'summary') return state;
      return { ...state, editingKey: action.key };
    }

    case 'RESTART':
      return { ...initialOnboardingState };

    case 'CONFIRM': {
      if (state.phase !== 'summary') return state;
      return { ...state, phase: 'done', editingKey: null };
    }

    default:
      return state;
  }
}
