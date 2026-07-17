import { describe, expect, it } from 'vitest';
import { configuredAvatarAdminEmails, isAvatarAdminEmail } from '../adminAccess';

describe('avatar admin access', () => {
  it('normalizes and accepts a comma-separated allowlist', () => {
    const env = { AVATAR_ADMIN_EMAILS: 'Owner@Example.com, artist@example.com ' };

    expect(configuredAvatarAdminEmails(env)).toEqual(
      new Set(['owner@example.com', 'artist@example.com'])
    );
    expect(isAvatarAdminEmail(' owner@example.com ', env)).toBe(true);
  });

  it('uses ADMIN_EMAIL as the single-admin fallback', () => {
    expect(isAvatarAdminEmail('owner@example.com', { ADMIN_EMAIL: 'OWNER@example.com' })).toBe(true);
  });

  it('fails closed when no allowlist is configured', () => {
    expect(isAvatarAdminEmail('owner@example.com', {})).toBe(false);
  });
});
