/**
 * Avatar uploads are restricted to an explicit email allowlist. The contact
 * form's ADMIN_EMAIL is accepted as a backwards-compatible single-admin
 * fallback, while AVATAR_ADMIN_EMAILS supports a comma-separated list.
 */
export function configuredAvatarAdminEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const configured = env.AVATAR_ADMIN_EMAILS?.trim() || env.ADMIN_EMAIL?.trim() || '';
  return new Set(
    configured
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAvatarAdminEmail(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!email) return false;
  return configuredAvatarAdminEmails(env).has(email.trim().toLowerCase());
}
