import { Resend } from "resend";

/**
 * Sends the OTP login code to `email` via Resend.
 *
 * Deployment note: Resend is deferred until a real account/domain is set up.
 * When `RESEND_API_KEY` is unset (local dev today), this gracefully no-ops
 * the actual send and just logs — it never throws, so local dev works
 * end-to-end without a Resend account. When a real key is added later, the
 * send path below runs unchanged.
 *
 * When `OTP_DEV_ECHO=true`, the code is also printed to the console
 * regardless of whether a real send happens, as a local dev convenience.
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const devEcho = process.env.OTP_DEV_ECHO === "true";

  if (devEcho) {
    console.log(`[OTP_DEV_ECHO] OTP code for ${email}: ${code}`);
  }

  if (!apiKey) {
    console.log(
      `[email] RESEND_API_KEY is not set — skipping real send to ${email}. ` +
        `(This is expected in local dev before a Resend account/domain is configured.)`
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    // TODO: replace with a verified sending domain once Resend is configured.
    from: "Learning English <onboarding@resend.dev>",
    to: email,
    subject: "Mã đăng nhập của bạn",
    html: `<p>Mã đăng nhập của bạn là: <strong>${code}</strong></p><p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>`,
  });

  if (error) {
    console.error(`[email] Resend send failed for ${email}:`, error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
}
