import { Resend } from "resend";

/**
 * Sends the OTP login code to `email` via Resend, from the verified domain
 * configured in `OTP_EMAIL_FROM` (e.g. `Learning English <no-reply@yourdomain.com>`).
 *
 * Throws when configuration is missing or the send fails. The caller
 * (`/api/auth/request-otp`) catches and logs the error while still returning
 * 200 to the client, so failures stay invisible to outside probes
 * (anti-enumeration) but loud in server logs.
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OTP_EMAIL_FROM;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set — cannot send OTP email. Set it in .env (docker) or web/.env.local (npm run dev)."
    );
  }
  if (!from) {
    throw new Error(
      'OTP_EMAIL_FROM is not set — cannot send OTP email. Expected e.g. "Learning English <no-reply@yourdomain.com>" on a Resend-verified domain.'
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Mã đăng nhập của bạn",
    html: [
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">',
      '<h2 style="margin:0 0 16px;color:#111827">Mã đăng nhập của bạn</h2>',
      '<p style="margin:0 0 24px;color:#374151">Nhập mã sau để đăng nhập vào Learning English:</p>',
      `<p style="font-size:32px;letter-spacing:8px;font-weight:bold;text-align:center;color:#111827;background:#f3f4f6;border-radius:8px;padding:16px 0;margin:0 0 24px">${code}</p>`,
      '<p style="margin:0;color:#6b7280;font-size:14px">Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>',
      "</div>",
    ].join(""),
  });

  if (error) {
    console.error(`[email] Resend send failed for ${email}:`, error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
}
