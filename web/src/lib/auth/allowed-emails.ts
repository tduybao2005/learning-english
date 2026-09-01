/**
 * Optional sign-in allowlist. `ALLOWED_EMAILS` is unset in every
 * environment except the one host that's meant to be single-learner-only —
 * unset/blank means unrestricted (preserves prior behavior everywhere
 * else: dev, test stack, other deployments).
 */
export function isAllowedEmail(
  email: string,
  allowedEmailsEnv: string | undefined = process.env.ALLOWED_EMAILS
): boolean {
  const raw = allowedEmailsEnv?.trim();
  if (!raw) return true;

  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}
