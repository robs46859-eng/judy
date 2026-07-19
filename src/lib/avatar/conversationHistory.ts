export interface ConversationHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export const MAX_CONVERSATION_HISTORY_CHARS = 4_000;

export function formatConversationHistory(
  history: readonly ConversationHistoryTurn[]
): string {
  const header = 'Recent conversation:';
  const selected: string[] = [];
  let length = header.length;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    const text = turn.text.trim();
    if (!text) continue;
    const line = `${turn.role === 'user' ? 'Traveler' : 'Judy'}: ${text}`;
    const nextLength = length + 1 + line.length;
    if (nextLength > MAX_CONVERSATION_HISTORY_CHARS) break;
    selected.unshift(line);
    length = nextLength;
  }

  return selected.length > 0 ? [header, ...selected].join('\n') : '';
}
