import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { upsert: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { upsertUserByEmail } from "./upsert-user";

describe("upsertUserByEmail", () => {
  beforeEach(() => {
    dbMock.user.upsert.mockReset();
    dbMock.user.upsert.mockResolvedValue({ id: "user_1" });
  });

  it("upserts by email, setting name only on create", async () => {
    const user = await upsertUserByEmail("hoc-vien@gmail.com", "Bảo Trần");
    expect(user.id).toBe("user_1");
    expect(dbMock.user.upsert).toHaveBeenCalledWith({
      where: { email: "hoc-vien@gmail.com" },
      update: {},
      create: { email: "hoc-vien@gmail.com", name: "Bảo Trần" },
      select: { id: true },
    });
  });

  it("creates with null name when Google returns none", async () => {
    await upsertUserByEmail("a@b.com", undefined);
    expect(dbMock.user.upsert).toHaveBeenCalledWith({
      where: { email: "a@b.com" },
      update: {},
      create: { email: "a@b.com", name: null },
      select: { id: true },
    });
  });
});
