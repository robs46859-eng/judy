// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VoiceSettings from '../VoiceSettings';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('VoiceSettings', () => {
  it('labels the read-aloud preference in terms of Judy replies', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response)
    );

    render(<VoiceSettings />);

    expect(
      screen.getByLabelText('Speak Judy’s replies automatically')
    ).toBeInTheDocument();
  });
});
