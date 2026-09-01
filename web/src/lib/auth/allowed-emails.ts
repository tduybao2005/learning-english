/**
 * Optional sign-in allowlist. Unset/blank means **unrestricted** — any Google
 * account can sign in, which is what the deployed host runs today so several
 * learners can share it.
 *
 * Điền `ALLOWED_EMAILS` (các email cách nhau bằng dấu phẩy) để đóng lại khi
 * cần; không có giá trị nào khác đóng được cổng này, nên đừng dựa vào việc
 * "ít người biết địa chỉ" để coi là đã giới hạn.
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
