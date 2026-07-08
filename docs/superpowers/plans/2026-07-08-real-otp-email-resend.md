# Real OTP Email via Resend (Verified Domain) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the login OTP code arrive as a real email in the user's Gmail/inbox, sent via Resend from the user's own verified domain — and remove the `OTP_DEV_ECHO` console-echo mechanism entirely.

**Architecture:** The OTP pipeline (random 6-digit generation, SHA-256 hashing, Postgres storage, rate limits, verify + JWT session) is already production-real. Only the delivery step is gated off: `web/src/lib/auth/email.ts` silently no-ops when `RESEND_API_KEY` is blank and echoes the code to stdout when `OTP_DEV_ECHO=true`. This plan rewrites that one function to require a real key + a configurable `From:` address on the verified domain, fail loudly (throw) on misconfiguration or send failure, and deletes every trace of `OTP_DEV_ECHO` from code, compose, env examples, Makefile, and README. The `request-otp` API route keeps its always-200 anti-enumeration behavior unchanged (it already catches and logs `sendOtpEmail` errors).

**Tech Stack:** Next.js 15 App Router, TypeScript, `resend` ^6.16.0 (already a dependency — **no new packages**), Vitest for tests, docker-compose for deployment.

## Context

Người dùng muốn: sau khi nhập Gmail ở màn hình log in, mã xác nhận 6 số phải được **gửi qua email thật** thay vì chỉ in ra log (`make logs`). Người dùng **đã có domain riêng** (DNS nhiều khả năng nằm trên Cloudflare — repo đã dùng Cloudflare tunnel), nên chọn phương án **Resend + verify domain**: giữ nguyên tích hợp Resend có sẵn, chỉ cần verify domain + điền API key. Người dùng cũng chọn **bỏ hẳn** cơ chế dev echo.

## Global Constraints

- **No new dependencies** — `resend` ^6.16.0 is already in `web/package.json`.
- **Keep anti-enumeration**: `/api/auth/request-otp` must keep returning `200 { sent: true }` for any syntactically valid email, even when sending fails (route file is NOT modified).
- **Never expose the OTP code** in any API response body or client-visible surface (existing invariant in `web/src/lib/auth/otp.ts`).
- **Email copy stays Vietnamese** (subject `"Mã đăng nhập của bạn"`, body text Vietnamese) — matches the app's Vietnamese UI convention.
- **`OTP_DEV_ECHO` must be gone everywhere** after this plan: code, `docker-compose.yml`, `.env.example`, `web/.env.example`, `Makefile`, `web/README.md`, and the real (gitignored) `.env` / `web/.env.local`.
- **Do not import nodemailer/Prisma into `web/src/middleware.ts`** (Edge runtime constraint) — not touched by this plan, listed as a guard.
- Work happens directly on `main`. Test command: `cd web && npm run test` (vitest via dotenv).
- Real secret files `.env` (root) and `web/.env.local` are gitignored and may be blocked from agent read/write — changes to them are **manual user steps** (Task 3), never committed.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `web/src/lib/auth/email.ts` | Rewrite | Real send only: require `RESEND_API_KEY` + `OTP_EMAIL_FROM`, throw on failure, nicer HTML template |
| `web/src/lib/auth/email.test.ts` | Create | Unit tests for config validation + send call + error propagation (Resend mocked) |
| `docker-compose.yml` | Modify (`web` service env, lines 31-32) | Drop `OTP_DEV_ECHO`, add `OTP_EMAIL_FROM` passthrough |
| `.env.example` (root) | Modify (lines ~19-21) | Drop `OTP_DEV_ECHO`, document `RESEND_API_KEY` + `OTP_EMAIL_FROM` |
| `web/.env.example` | Modify (lines ~4-5) | Same for `npm run dev` path |
| `Makefile` | Modify (line 10) | Fix stale `make logs` help text mentioning OTP echo |
| `web/README.md` | Modify (lines ~18-20, 33-34, 54-55) | Document the real-email setup, remove all `OTP_DEV_ECHO` docs |
| `.env`, `web/.env.local` | Manual (user) | Fill real `RESEND_API_KEY` + `OTP_EMAIL_FROM`, delete `OTP_DEV_ECHO` |

Files intentionally **not** changed: `web/src/app/api/auth/request-otp/route.ts` (already catches/logs errors and returns 200), `web/src/lib/auth/otp.ts`, `verify-otp/route.ts`, login/verify pages.

---

### Task 1: Rewrite `sendOtpEmail` — real send only, TDD

**Files:**
- Create: `web/src/lib/auth/email.test.ts`
- Modify: `web/src/lib/auth/email.ts` (full rewrite of the 45-line file)

**Interfaces:**
- Consumes: `process.env.RESEND_API_KEY`, `process.env.OTP_EMAIL_FROM`; `Resend` class from the `resend` package.
- Produces: `sendOtpEmail(email: string, code: string): Promise<void>` — **same signature as today**, so the existing caller `web/src/app/api/auth/request-otp/route.ts:28` needs no change. New behavior: throws `Error` when `RESEND_API_KEY` or `OTP_EMAIL_FROM` is unset/empty, or when Resend returns an error.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/auth/email.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}));

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/ncd/learnspaces/learning_english/web && npm run test -- src/lib/auth/email.test.ts`

Expected: FAIL — the two "throws when …" tests fail because the current implementation silently returns instead of throwing (and there is no `OTP_EMAIL_FROM` check); the "sends via Resend" test fails on `payload.from` (current hardcoded `"Learning English <onboarding@resend.dev>"`).

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `web/src/lib/auth/email.ts` with:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/ncd/learnspaces/learning_english/web && npm run test -- src/lib/auth/email.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full web test suite (guard against regressions, esp. `otp.test.ts`)**

Run: `cd /home/ncd/learnspaces/learning_english/web && npm run test`
Expected: all suites PASS. (`request-otp` route has no unit test; `otp.test.ts` does not touch `email.ts`.)

- [ ] **Step 6: Commit**

```bash
cd /home/ncd/learnspaces/learning_english
git add web/src/lib/auth/email.ts web/src/lib/auth/email.test.ts
git commit -m "feat(web): send real OTP emails via Resend verified domain, drop OTP_DEV_ECHO from send path"
```

---

### Task 2: Env plumbing + docs — remove `OTP_DEV_ECHO`, add `OTP_EMAIL_FROM`

**Files:**
- Modify: `docker-compose.yml:31-32`
- Modify: `.env.example` (root, lines ~18-21)
- Modify: `web/.env.example` (lines ~4-5)
- Modify: `Makefile:10`
- Modify: `web/README.md` (lines ~18-20, ~33-34, ~54-55 — search `OTP_DEV_ECHO`)

**Interfaces:**
- Consumes: `sendOtpEmail`'s new env contract from Task 1 (`RESEND_API_KEY` required, `OTP_EMAIL_FROM` required).
- Produces: `OTP_EMAIL_FROM` flows from root `.env` → `docker compose` → web container; and from `web/.env.local` → `npm run dev`. No file in the repo mentions `OTP_DEV_ECHO` afterwards.

- [ ] **Step 1: Update `docker-compose.yml`**

In the `web` service `environment:` block, replace:

```yaml
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      OTP_DEV_ECHO: ${OTP_DEV_ECHO:-true}
```

with:

```yaml
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      OTP_EMAIL_FROM: ${OTP_EMAIL_FROM:-}
```

- [ ] **Step 2: Update root `.env.example`**

Replace the Resend block (currently ~lines 18-21, comment `# Fill in once you have a real Resend account and set OTP_DEV_ECHO=false.` + `RESEND_API_KEY=` + `OTP_DEV_ECHO=true`) with:

```bash
# Resend (https://resend.com) — real OTP email delivery.
# 1) Verify your domain in the Resend dashboard (DNS records on Cloudflare).
# 2) Create an API key and paste it here.
# 3) Set the From address on that verified domain.
# Both values are REQUIRED — login codes cannot be delivered without them.
RESEND_API_KEY=
OTP_EMAIL_FROM="Learning English <no-reply@your-domain.example>"
```

(Read the file first to reproduce surrounding lines exactly; only this block changes.)

- [ ] **Step 3: Update `web/.env.example`**

Replace (~lines 4-5):

```bash
RESEND_API_KEY="re_..."
OTP_DEV_ECHO="false"
```

with:

```bash
RESEND_API_KEY="re_..."
OTP_EMAIL_FROM="Learning English <no-reply@your-domain.example>"
```

- [ ] **Step 4: Update `Makefile` help text**

Line 10, replace:

```make
	@echo "make logs        - tail web logs (OTP codes print here, OTP_DEV_ECHO=true)"
```

with:

```make
	@echo "make logs        - tail web logs"
```

- [ ] **Step 5: Update `web/README.md`**

Search the file for every `OTP_DEV_ECHO` occurrence (~lines 18-20, 33-34, 54-55) and rewrite those passages to describe the new behavior. Specifically:

- The dev-notes passage (~18-20) saying codes print to stdout: replace with — OTP emails are sent for real via Resend; `RESEND_API_KEY` **and** `OTP_EMAIL_FROM` (an address on the Resend-verified domain) must be set in `web/.env.local` / root `.env`, otherwise `/api/auth/request-otp` logs an error server-side and no code is delivered.
- The production-setup step (~33-34): replace with — "Verify a sending domain in Resend, set `RESEND_API_KEY` and `OTP_EMAIL_FROM`."
- The env-vars table rows (~54-55): keep the `RESEND_API_KEY` row (new description: "Real Resend API key — required; OTP emails fail loudly in logs without it"), **delete** the `OTP_DEV_ECHO` row, **add** an `OTP_EMAIL_FROM` row ("From address on the Resend-verified domain, e.g. `Learning English <no-reply@yourdomain.com>` — required").

- [ ] **Step 6: Verify nothing references `OTP_DEV_ECHO` anymore**

Run:

```bash
grep -rn "OTP_DEV_ECHO" /home/ncd/learnspaces/learning_english \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude-dir=docs
```

Expected: matches only in the real gitignored `.env` / `web/.env.local` (cleaned manually in Task 3) and historical plan docs under `docs/superpowers/plans/` (frozen — do not edit). Zero matches in code/compose/Makefile/README/env examples.

Also validate compose renders:

```bash
cd /home/ncd/learnspaces/learning_english && docker compose config --quiet
```

Expected: exit 0, no warnings about `OTP_DEV_ECHO`.

- [ ] **Step 7: Commit**

```bash
cd /home/ncd/learnspaces/learning_english
git add docker-compose.yml .env.example web/.env.example Makefile web/README.md
git commit -m "chore: replace OTP_DEV_ECHO with required OTP_EMAIL_FROM env plumbing"
```

---

### Task 3: Manual setup — verify domain in Resend + fill real secrets (USER does this)

These steps happen in browsers/dashboards and in gitignored secret files — the agent cannot and must not do them. Present this checklist to the user:

- [ ] **Step 1: Create/log in to Resend** at https://resend.com (free tier: 3,000 emails/month, 100/day — thừa đủ cho OTP).

- [ ] **Step 2: Verify the domain** — Resend dashboard → **Domains** → **Add Domain** → nhập domain của bạn (khuyến nghị dùng subdomain gửi mail, ví dụ `mail.your-domain.com`, để tách reputation khỏi domain chính). Resend sẽ đưa ra ~3 DNS record (DKIM TXT/CNAME, SPF TXT, MX cho bounce). Nếu DNS nằm trên **Cloudflare**, Resend có nút "Sign in to Cloudflare" tự thêm record; nếu thêm tay, nhớ đặt record ở chế độ **DNS only** (đám mây xám, không proxy). Chờ trạng thái domain chuyển **Verified** (thường vài phút).

- [ ] **Step 3: Create an API key** — dashboard → **API Keys** → **Create API Key**, quyền "Sending access", copy chuỗi `re_...` (chỉ hiện một lần).

- [ ] **Step 4: Fill real env files** (không commit):
  - Root `.env` (dùng cho `docker compose` / `make`): xóa dòng `OTP_DEV_ECHO=true`, điền:
    ```bash
    RESEND_API_KEY=re_<key thật>
    OTP_EMAIL_FROM="Learning English <no-reply@mail.your-domain.com>"
    ```
    (Địa chỉ `no-reply@...` không cần tồn tại như hộp thư — chỉ cần domain đã Verified.)
  - `web/.env.local` (dùng cho `npm run dev` / `npm run test`): tương tự — thay `RESEND_API_KEY` placeholder bằng key thật, xóa `OTP_DEV_ECHO`, thêm `OTP_EMAIL_FROM`.

- [ ] **Step 5: Restart the stack** so the container picks up new env: `make` / `docker compose up -d --build web` (hoặc restart `npm run dev`).

---

### Task 4: End-to-end verification

- [ ] **Step 1: Request a code from the real login screen**

Open the app (local `http://localhost:3000/login` or the Cloudflare-tunnel URL) → nhập địa chỉ Gmail thật của bạn → **Gửi mã đăng nhập**.

Expected: UI chuyển sang `/login/verify?email=...` như cũ.

- [ ] **Step 2: Check server logs show no errors and no code echo**

Run: `make logs` (or `docker compose logs -f web`).
Expected: **no** `[OTP_DEV_ECHO]` line, **no** `[request-otp] failed:` / `[email] Resend send failed` errors.

- [ ] **Step 3: Check the inbox**

Mở Gmail: nhận được email từ `Learning English <no-reply@...>`, tiêu đề **"Mã đăng nhập của bạn"**, chứa mã 6 số. (Lần đầu có thể vào Spam — bấm "Not spam".) Also visible in Resend dashboard → **Emails** → status `Delivered`.

- [ ] **Step 4: Complete the login**

Nhập mã 6 số ở `/login/verify`. Expected: đăng nhập thành công → `/dashboard` (hoặc `/onboarding/name` nếu là user mới).

- [ ] **Step 5: Negative check — misconfig fails loudly, leaks nothing**

Optional sanity: temporarily unset `RESEND_API_KEY` in env, restart, request a code. Expected: client still gets 200 + advances to verify screen (anti-enumeration preserved), but `make logs` shows `[request-otp] failed: Error: RESEND_API_KEY is not set...` and no email arrives. Restore the key and restart afterwards.

---

## Self-Review

- **Spec coverage:** real email delivery via user's own domain (Task 1 + 3), dev echo removed everywhere (Tasks 1–3), end-to-end proof (Task 4). ✓
- **Placeholder scan:** all code/config steps show exact content; the only "user does it" steps are dashboard/secret-file actions that cannot be automated. ✓
- **Type consistency:** `sendOtpEmail(email: string, code: string): Promise<void>` unchanged — caller `request-otp/route.ts:28` untouched; env names `RESEND_API_KEY` / `OTP_EMAIL_FROM` identical across email.ts, tests, compose, env examples, README. ✓
