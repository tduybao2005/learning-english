import { NextResponse } from "next/server";
import { z } from "zod";

import { issueOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/auth/email";

const requestOtpSchema = z.object({ email: z.string().email() });

/**
 * Always responds 200 `{ sent: true }` for a syntactically valid email,
 * regardless of whether the OTP was actually issued (rate-limited) or the
 * email failed to send — this avoids leaking whether an account/rate-limit
 * state exists (no user enumeration).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestOtpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const { email } = parsed.data;

  try {
    const result = await issueOtp(email);
    if (result.sent) {
      await sendOtpEmail(email, result.code);
    }
  } catch (err) {
    // Swallow internal errors from the client's perspective — same response
    // either way, so failures can't be used to probe account/rate state.
    console.error("[request-otp] failed:", err);
  }

  return NextResponse.json({ sent: true }, { status: 200 });
}
