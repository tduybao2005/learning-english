import crypto from "crypto";

import { db } from "@/lib/db";

const OTP_LENGTH_MIN = 100000;
const OTP_LENGTH_MAX = 999999; // crypto.randomInt upper bound is exclusive, per the brief.
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_ISSUES_PER_HOUR = 5; // a 6th issue within the window is blocked
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 60s minimum gap between issues

export type IssueOtpResult = { sent: true; code: string } | { sent: false; reason: "rate_limited" };

export type VerifyOtpResult =
  | { ok: true; userId: string; needsOnboarding: boolean }
  | { ok: false; reason: "expired" | "invalid" | "locked" | "rate_limited" };

function hashCode(code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return crypto.createHash("sha256").update(code + secret).digest("hex");
}

/**
 * Issues a new OTP for `email`, enforcing rate limits:
 * - at most 5 issues per rolling hour (a 6th is rejected)
 * - at least 60s between consecutive issues
 *
 * Returns the plaintext `code` on success (used internally by email.ts to
 * send/dev-echo it) — never expose this value in an API response body.
 */
export async function issueOtp(email: string): Promise<IssueOtpResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  const recent = await db.otpCode.findMany({
    where: { email, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
  });

  if (recent.length > 0) {
    const mostRecent = recent[0];
    const sinceLast = now.getTime() - mostRecent.createdAt.getTime();
    if (sinceLast < RATE_LIMIT_COOLDOWN_MS) {
      return { sent: false, reason: "rate_limited" };
    }
  }

  if (recent.length >= RATE_LIMIT_MAX_ISSUES_PER_HOUR) {
    return { sent: false, reason: "rate_limited" };
  }

  const code = crypto.randomInt(OTP_LENGTH_MIN, OTP_LENGTH_MAX).toString();
  const codeHash = hashCode(code);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  await db.otpCode.create({
    data: { email, codeHash, expiresAt },
  });

  return { sent: true, code };
}

/**
 * Verifies `code` against the most recent unconsumed OTP for `email`.
 * On success, upserts the User by email (creating them on first login) and
 * consumes the code so it cannot be reused.
 */
export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const now = new Date();

  const otp = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { ok: false, reason: "invalid" };
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "locked" };
  }

  if (otp.expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  const codeHash = hashCode(code);
  if (codeHash !== otp.codeHash) {
    const updated = await db.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= MAX_ATTEMPTS) {
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid" };
  }

  await db.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: now },
  });

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  return { ok: true, userId: user.id, needsOnboarding: user.goalType === null };
}
