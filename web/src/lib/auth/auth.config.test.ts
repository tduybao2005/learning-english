import { afterEach, describe, expect, it, vi } from "vitest";

import { authConfig } from "@/lib/auth/auth.config";

/**
 * `authorized` là cổng chặn của middleware, chạy trên MỌI request tới các
 * route trong `config.matcher`. Nó phải xét lại allowlist chứ không chỉ xét
 * "có phiên hợp lệ không": phiên là JWT 30 ngày, không có bảng `Session` để
 * thu hồi, nên nếu chỉ kiểm ở lúc đăng nhập thì người bị gỡ khỏi
 * `ALLOWED_EMAILS` vẫn dùng tiếp được cả tháng.
 */
function authorized(session: unknown) {
  const fn = authConfig.callbacks?.authorized;
  if (!fn) throw new Error("authConfig thiếu callback `authorized`");
  return fn({ auth: session } as Parameters<typeof fn>[0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authorized", () => {
  it("cho qua khi email nằm trong allowlist", () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@gmail.com,b@gmail.com");

    expect(authorized({ user: { id: "u1", email: "b@gmail.com" } })).toBe(true);
  });

  it("chặn phiên cũ của người KHÔNG còn trong allowlist", () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@gmail.com");

    expect(authorized({ user: { id: "u2", email: "nguoila@gmail.com" } })).toBe(false);
  });

  it("chặn khi phiên không mang email — không có email thì không chứng minh được là ai", () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@gmail.com");

    expect(authorized({ user: { id: "u3" } })).toBe(false);
  });

  it("allowlist rỗng thì mọi phiên hợp lệ đều qua", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");

    expect(authorized({ user: { id: "u4", email: "ai-cung-duoc@gmail.com" } })).toBe(true);
  });

  it("chặn khi chưa đăng nhập", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");

    expect(authorized(null)).toBe(false);
  });
});
