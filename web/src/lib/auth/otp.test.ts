import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- In-memory fake Prisma client (mocks `db` from Task 2) ----
type OtpRow = {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
};

type UserRow = { id: string; email: string; goalType: string | null };

let otpRows: OtpRow[] = [];
let userRows: Map<string, UserRow> = new Map();
let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `id_${idCounter}`;
}

/** Backdates the most recently created OTP row's createdAt by `ms`. */
function backdateLast(ms: number) {
  const last = otpRows[otpRows.length - 1];
  last.createdAt = new Date(last.createdAt.getTime() - ms);
}

const fakeDb = {
  otpCode: {
    create: vi.fn(async ({ data }: { data: { email: string; codeHash: string; expiresAt: Date } }) => {
      const row: OtpRow = {
        id: nextId(),
        email: data.email,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(),
      };
      otpRows.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where }: { where: { email: string; createdAt?: { gte: Date } } }) => {
      return otpRows
        .filter((r) => {
          if (r.email !== where.email) return false;
          if (where.createdAt?.gte && r.createdAt < where.createdAt.gte) return false;
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }),
    findFirst: vi.fn(async ({ where }: { where: { email: string; consumedAt: null } }) => {
      const rows = otpRows
        .filter((r) => r.email === where.email && r.consumedAt === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows[0] ?? null;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { attempts?: { increment: number }; consumedAt?: Date };
      }) => {
        const row = otpRows.find((r) => r.id === where.id);
        if (!row) throw new Error("row not found");
        if (data.attempts?.increment) row.attempts += data.attempts.increment;
        if (data.consumedAt !== undefined) row.consumedAt = data.consumedAt;
        return row;
      }
    ),
  },
  user: {
    upsert: vi.fn(async ({ where }: { where: { email: string } }) => {
      const existing = userRows.get(where.email);
      if (existing) return existing;
      const u: UserRow = { id: nextId(), email: where.email, goalType: null };
      userRows.set(where.email, u);
      return u;
    }),
  },
};

vi.mock("@/lib/db", () => ({ db: fakeDb }));

// Import after the mock is registered.
const { issueOtp, verifyOtp } = await import("./otp");

beforeEach(() => {
  otpRows = [];
  userRows = new Map();
  idCounter = 0;
  process.env.SESSION_SECRET = "test-secret-for-otp-tests";
  vi.clearAllMocks();
});

describe("issueOtp / verifyOtp", () => {
  it("correct code verifies once, then the code is consumed (second attempt is invalid)", async () => {
    const issued = await issueOtp("alice@example.com");
    expect(issued.sent).toBe(true);
    if (!issued.sent) throw new Error("expected sent");

    const first = await verifyOtp("alice@example.com", issued.code);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("expected ok");
    expect(first.userId).toBeTruthy();
    expect(first.needsOnboarding).toBe(true);

    const second = await verifyOtp("alice@example.com", issued.code);
    expect(second).toEqual({ ok: false, reason: "invalid" });
  });

  it("5 wrong attempts locks the code", async () => {
    await issueOtp("bob@example.com");

    for (let i = 0; i < 4; i++) {
      const r = await verifyOtp("bob@example.com", "000000");
      expect(r).toEqual({ ok: false, reason: "invalid" });
    }

    const fifth = await verifyOtp("bob@example.com", "000000");
    expect(fifth).toEqual({ ok: false, reason: "locked" });

    // Further attempts stay locked even with the correct code.
    const sixth = await verifyOtp("bob@example.com", "000000");
    expect(sixth).toEqual({ ok: false, reason: "locked" });
  });

  it("expired code (>10 min old) returns expired", async () => {
    const issued = await issueOtp("carol@example.com");
    expect(issued.sent).toBe(true);
    if (!issued.sent) throw new Error("expected sent");

    // Force expiry directly on the stored row.
    otpRows[0].expiresAt = new Date(Date.now() - 1000);

    const result = await verifyOtp("carol@example.com", issued.code);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("6th issue within an hour is rate_limited", async () => {
    const email = "dave@example.com";
    for (let i = 0; i < 5; i++) {
      const res = await issueOtp(email);
      expect(res.sent).toBe(true);
      // Push the issue far enough into the past to clear the 60s cooldown,
      // but keep it inside the 1-hour rate-limit window.
      backdateLast(2 * 60 * 1000);
    }

    const sixth = await issueOtp(email);
    expect(sixth).toEqual({ sent: false, reason: "rate_limited" });
  });

  it("issuing again within 60s of the previous issue is rate_limited", async () => {
    const email = "erin@example.com";
    const first = await issueOtp(email);
    expect(first.sent).toBe(true);

    const second = await issueOtp(email);
    expect(second).toEqual({ sent: false, reason: "rate_limited" });
  });
});
