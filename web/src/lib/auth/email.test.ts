import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => {
  class Resend {
    constructor(apiKey: string) {}
    emails = { send: sendMock };
  }
  return { Resend };
});

import { sendOtpEmail } from "./email";

describe("sendOtpEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("OTP_EMAIL_FROM", "Learning English <no-reply@example.com>");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when RESEND_API_KEY is not set", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendOtpEmail("a@b.com", "123456")).rejects.toThrow(
      /RESEND_API_KEY/
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws when OTP_EMAIL_FROM is not set", async () => {
    vi.stubEnv("OTP_EMAIL_FROM", "");
    await expect(sendOtpEmail("a@b.com", "123456")).rejects.toThrow(
      /OTP_EMAIL_FROM/
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends via Resend from OTP_EMAIL_FROM with the code in the body", async () => {
    await sendOtpEmail("hoc-vien@gmail.com", "654321");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.from).toBe("Learning English <no-reply@example.com>");
    expect(payload.to).toBe("hoc-vien@gmail.com");
    expect(payload.subject).toBe("Mã đăng nhập của bạn");
    expect(payload.html).toContain("654321");
  });

  it("throws when Resend reports a send error", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "domain not verified", name: "validation_error" },
    });
    await expect(sendOtpEmail("a@b.com", "123456")).rejects.toThrow(
      /domain not verified/
    );
  });
});
