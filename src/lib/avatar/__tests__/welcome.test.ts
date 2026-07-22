import { describe, expect, it } from 'vitest';
import { localizedJudyWelcome } from '../welcome';

describe('localizedJudyWelcome', () => {
  it('uses the selected spoken language without a server translation round trip', () => {
    expect(localizedJudyWelcome('zh-CN')).toContain('朱迪');
    expect(localizedJudyWelcome('es-MX')).toContain('Hola');
  });

  it('falls back to English for missing or unsupported locales', () => {
    expect(localizedJudyWelcome(null)).toContain("I'm Judy Pierre");
    expect(localizedJudyWelcome('xx-XX')).toContain("I'm Judy Pierre");
  });
});
