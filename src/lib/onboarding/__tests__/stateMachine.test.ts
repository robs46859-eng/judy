import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  currentStep,
  initialOnboardingState,
  onboardingReducer,
  type OnboardingState,
} from '../stateMachine';

function answerAll(values: string[]): OnboardingState {
  let state = initialOnboardingState;
  for (const value of values) {
    state = onboardingReducer(state, { type: 'ANSWER', value });
  }
  return state;
}

describe('onboardingReducer', () => {
  it('asks one question at a time, in the fixed deterministic order', () => {
    let state = initialOnboardingState;
    expect(currentStep(state)?.key).toBe('nativeLanguage');

    state = onboardingReducer(state, { type: 'ANSWER', value: 'English' });
    expect(state.phase).toBe('asking');
    expect(currentStep(state)?.key).toBe('translationLanguage');
    expect(state.answers.nativeLanguage).toBe('English');
  });

  it('reaches the summary phase only after all questions are answered or skipped', () => {
    const state = answerAll(['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']);
    expect(state.phase).toBe('summary');
    expect(state.answers.helpPreference).toBe('Booking recs');
  });

  it('SKIP advances without recording an answer, and marks the field skipped', () => {
    let state = initialOnboardingState;
    state = onboardingReducer(state, { type: 'SKIP' });
    expect(state.answers.nativeLanguage).toBeUndefined();
    expect(state.skipped.nativeLanguage).toBe(true);
    expect(currentStep(state)?.key).toBe('translationLanguage');
  });

  it('BACK returns to the previous question without losing its answer', () => {
    let state = initialOnboardingState;
    state = onboardingReducer(state, { type: 'ANSWER', value: 'English' });
    state = onboardingReducer(state, { type: 'ANSWER', value: 'Spanish' });
    expect(currentStep(state)?.key).toBe('travelRoute');

    state = onboardingReducer(state, { type: 'BACK' });
    expect(currentStep(state)?.key).toBe('translationLanguage');
    expect(state.answers.translationLanguage).toBe('Spanish'); // not cleared
  });

  it('BACK is a no-op on the very first question', () => {
    const state = onboardingReducer(initialOnboardingState, { type: 'BACK' });
    expect(state).toEqual(initialOnboardingState);
  });

  it('BACK from the summary re-opens the last question', () => {
    const summary = answerAll(['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']);
    const back = onboardingReducer(summary, { type: 'BACK' });
    expect(back.phase).toBe('asking');
    expect(currentStep(back)?.key).toBe('helpPreference');
  });

  it('EDIT + ANSWER from the summary updates a single field without touching the others', () => {
    const summary = answerAll(['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']);
    const editing = onboardingReducer(summary, { type: 'EDIT', key: 'nativeLanguage' });
    expect(editing.editingKey).toBe('nativeLanguage');

    const edited = onboardingReducer(editing, { type: 'ANSWER', value: 'French' });
    expect(edited.phase).toBe('summary');
    expect(edited.editingKey).toBeNull();
    expect(edited.answers.nativeLanguage).toBe('French');
    expect(edited.answers.translationLanguage).toBe('Spanish');
  });

  it('EDIT + SKIP from the summary clears just that one field', () => {
    const summary = answerAll(['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']);
    const editing = onboardingReducer(summary, { type: 'EDIT', key: 'travelRoute' });
    const skipped = onboardingReducer(editing, { type: 'SKIP' });
    expect(skipped.skipped.travelRoute).toBe(true);
    expect(skipped.answers.travelRoute).toBeUndefined();
    expect(skipped.answers.nativeLanguage).toBe('English');
  });

  it('RESTART wipes everything back to the initial state, from any phase', () => {
    const summary = answerAll(['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']);
    const restarted = onboardingReducer(summary, { type: 'RESTART' });
    expect(restarted).toEqual(initialOnboardingState);
  });

  it('CONFIRM only takes effect from the summary phase — never mid-flow', () => {
    let state = onboardingReducer(initialOnboardingState, { type: 'ANSWER', value: 'English' });
    state = onboardingReducer(state, { type: 'CONFIRM' });
    expect(state.phase).toBe('asking'); // ignored — not on the summary yet

    const summary = answerAll(['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']);
    const confirmed = onboardingReducer(summary, { type: 'CONFIRM' });
    expect(confirmed.phase).toBe('done');
  });

  it('exposes exactly the five deterministic questions, in order', () => {
    expect(ONBOARDING_STEPS.map((s) => s.key)).toEqual([
      'nativeLanguage',
      'translationLanguage',
      'travelRoute',
      'preTravelTasks',
      'helpPreference',
    ]);
  });

  it('currentStep is null once the flow has left the asking phase', () => {
    const summary = answerAll(['English', 'Spanish', 'NYC to Madrid', 'Renew passport', 'Booking recs']);
    expect(currentStep(summary)).toBeNull();
  });
});
