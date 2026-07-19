import { describe, expect, it } from 'vitest';
import { formatConversationHistory } from '../conversationHistory';

describe('formatConversationHistory', () => {
  it('formats traveler and Judy turns for model grounding', () => {
    expect(
      formatConversationHistory([
        { role: 'user', text: 'I am going to Madrid.' },
        { role: 'assistant', text: 'What dates are you traveling?' },
      ])
    ).toBe(
      'Recent conversation:\nTraveler: I am going to Madrid.\nJudy: What dates are you traveling?'
    );
  });

  it('keeps the most recent turns under the 4,000-character server budget', () => {
    const history = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `${index}-${'x'.repeat(795)}`,
    }));
    const formatted = formatConversationHistory(history);

    expect(formatted.length).toBeLessThanOrEqual(4_000);
    expect(formatted).toContain('7-');
    expect(formatted).not.toContain('0-');
  });

  it('returns an empty string for no usable history', () => {
    expect(formatConversationHistory([])).toBe('');
  });
});
