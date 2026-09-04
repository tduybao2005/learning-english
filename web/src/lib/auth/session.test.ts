import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, findUnique } = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("@/lib/auth/auth", () => ({ auth }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique } } }));

import { getSessionUser } from "@/lib/auth/session";

/**
 * Middleware chỉ chạy trên `config.matcher` (các trang), KHÔNG chạy cho
 * `/api/*`. Nên allowlist phải được xét lại ở đây nữa, nếu không một phiên
 * JWT cũ vẫn gọi API lấy/ghi dữ liệu được dù chủ nhân đã bị gỡ khỏi danh sách.
 */
beforeEach(() => {
  auth.mockReset();
  findUnique.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSessionUser", () => {
  it("trả về user khi email còn trong allowlist", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@gmail.com");
    auth.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue({ id: "u1", email: "a@gmail.com" });

    expect(await getSessionUser()).toEqual({ id: "u1", email: "a@gmail.com" });
  });

  it("trả về null cho phiên cũ của người đã bị gỡ khỏi allowlist", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@gmail.com");
    auth.mockResolvedValue({ user: { id: "u2" } });
    findUnique.mockResolvedValue({ id: "u2", email: "nguoila@gmail.com" });

    expect(await getSessionUser()).toBeNull();
  });

  it("allowlist rỗng thì ai cũng qua", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    auth.mockResolvedValue({ user: { id: "u3" } });
    findUnique.mockResolvedValue({ id: "u3", email: "ai-cung-duoc@gmail.com" });

    expect(await getSessionUser()).toEqual({ id: "u3", email: "ai-cung-duoc@gmail.com" });
  });

  it("trả về null khi chưa đăng nhập", async () => {
    auth.mockResolvedValue(null);

    expect(await getSessionUser()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
