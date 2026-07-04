import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verifyOtpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const { email, code } = parsed.data;
  const result = await verifyOtp(email, code);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  await createSession(result.userId);

  return NextResponse.json({ ok: true, needsOnboarding: result.needsOnboarding }, { status: 200 });
}
