# Google OAuth Login via NextAuth v5 (replace email OTP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace passwordless email-OTP login entirely with "Đăng nhập bằng Google" (Google OAuth via NextAuth/Auth.js v5), removing all OTP code, the Resend integration, and the old OTP plan file.

**Architecture:** NextAuth v5 with the Google provider and **JWT session strategy (no DB adapter)** — the existing Prisma `User` model stays the source of truth. A `jwt` callback upserts the user by email on sign-in (preserving today's upsert-by-email + `needsOnboarding: goalType === null` semantics) and stores `userId` in the token. Config is split into an edge-safe `auth.config.ts` (used by `middleware.ts`, no Prisma) and a Node `auth.ts` (with the Prisma callback). `getSessionUser()` keeps its exact signature so the ~25 call sites need no change. All OTP artifacts (routes, libs, tests, `/login/verify` page, `OtpCode` model, Resend env/deps) are deleted.

**Tech Stack:** Next.js 15.5, React 19, `next-auth@beta` (v5 — the ONE new dependency), `jose` (kept, used internally by NextAuth), Prisma/Postgres, Vitest, docker-compose + Cloudflare tunnel.

## Context

Người dùng vừa hoàn thành plan gửi OTP qua Resend, nhưng quyết định **chuyển hẳn sang đăng nhập bằng Google** (nút "Tiếp tục với Google" đã tồn tại sẵn ở trạng thái disabled trên trang login). Yêu cầu: bỏ hẳn OTP (không giữ song song), dùng NextAuth (Auth.js), và **xóa plan OTP cũ** (`docs/superpowers/plans/2026-07-08-real-otp-email-resend.md`).

## Global Constraints

- **One new dependency only:** `next-auth@beta` (v5). Remove `resend` from dependencies. `jose` stays (NextAuth needs it; nothing else imports it after this plan except NextAuth internals — our own middleware/session code stops importing it).
- **`getSessionUser(): Promise<User | null>` keeps its exact name, module path (`@/lib/auth/session`), and return type** — ~25 call sites and `answers.test.ts`'s mock depend on it.
- **Preserve onboarding semantics:** user upserted by email on first login; `needsOnboarding = goalType === null` must still route new users to `/onboarding/name` (moved from the deleted verify page into `(app)/layout.tsx`).
- **`web/src/middleware.ts` stays edge-safe:** may import NextAuth + `auth.config.ts` only — never Prisma/`@/lib/db`, never `auth.ts`.
- **After this plan, zero references remain** to: `OTP_DEV_ECHO`, `RESEND_API_KEY`, `OTP_EMAIL_FROM`, `SESSION_SECRET`, `SESSION_COOKIE_SECURE`, `OtpCode`, `sendOtpEmail`, `issueOtp`, `verifyOtp`, `request-otp`, `verify-otp` — in code, compose, Makefile, env examples, README. (Historical plan docs under `docs/superpowers/plans/` are frozen and excluded — except the OTP plan file which is deleted outright per user request.)
- New env contract: `AUTH_SECRET` (reuse the old `SESSION_SECRET` value is fine), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` (e.g. `http://localhost:3000` locally, the Cloudflare-tunnel https URL in prod). `trustHost: true` is set in config (required behind the tunnel/docker).
- UI copy stays Vietnamese. Work happens directly on `main`. Test command: `cd web && npm run test`.
- Real secret files `.env` / `web/.env.local` are gitignored — filling real Google credentials is a manual user step (Task 6), never committed. Note: the `Read` tool is blocked on `.env*` files in this environment; agents must use Bash (`cat`, heredoc) for them.
- Prisma migration (`drop OtpCode`) requires the local Postgres running (`docker compose up -d db`); if unavailable, create the migration with `--create-only` and note it in the report.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `web/src/lib/auth/auth.config.ts` | Create | Edge-safe NextAuth config: Google provider, pages, JWT strategy, `authorized` callback, `trustHost` |
| `web/src/lib/auth/auth.ts` | Create | `NextAuth(...)` instance with Prisma `jwt`/`session` callbacks; exports `handlers, auth, signIn, signOut` |
| `web/src/lib/auth/upsert-user.ts` | Create | `upsertUserByEmail(email, name)` — testable Prisma upsert used by the jwt callback |
| `web/src/lib/auth/upsert-user.test.ts` | Create | Unit tests (db mocked) |
| `web/src/app/api/auth/[...nextauth]/route.ts` | Create | Re-export NextAuth `handlers` |
| `web/src/lib/auth/session.ts` | Rewrite | `getSessionUser()` via `auth()`; drop `createSession`/`destroySession`/cookie code |
| `web/src/middleware.ts` | Rewrite | `NextAuth(authConfig).auth` middleware, same matcher |
| `web/src/app/(auth)/login/page.tsx` | Rewrite | Single enabled "Tiếp tục với Google" button (`signIn("google")` from `next-auth/react`) |
| `web/src/app/(app)/layout.tsx` | Modify | Add `if (user.goalType === null) redirect("/onboarding/name")` |
| `web/src/components/LogoutButton.tsx` | Modify | Use `signOut({ callbackUrl: "/login" })` from `next-auth/react` |
| `web/src/app/(auth)/login/verify/page.tsx` | Delete | OTP entry page |
| `web/src/app/api/auth/request-otp/route.ts`, `verify-otp/route.ts`, `logout/route.ts` | Delete | OTP + cookie logout routes |
| `web/src/lib/auth/otp.ts`, `otp.test.ts`, `email.ts`, `email.test.ts` | Delete | OTP issue/verify + Resend send |
| `web/prisma/schema.prisma` | Modify | Drop `OtpCode` model (+ migration) |
| `web/package.json` | Modify | `+ next-auth@beta`, `- resend` |
| `docker-compose.yml`, `.env.example`, `web/.env.example`, `Makefile`, `web/README.md` | Modify | New env contract, remove all OTP/Resend/SESSION_SECRET docs |
| `docs/superpowers/plans/2026-07-08-real-otp-email-resend.md` | Delete | Per user request |
| `.env`, `web/.env.local` | Manual (user + agent via Bash) | Fill `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_URL`; remove Resend/OTP vars |

Files intentionally NOT changed: all 25 `getSessionUser()` call sites, `answers.test.ts`, onboarding pages, settings page.

---

### Task 1: NextAuth core — config split, route handler, user upsert (TDD on the upsert)

**Files:**
- Create: `web/src/lib/auth/auth.config.ts`, `web/src/lib/auth/auth.ts`, `web/src/lib/auth/upsert-user.ts`, `web/src/lib/auth/upsert-user.test.ts`, `web/src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`; env `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`.
- Produces: `auth`, `signIn`, `signOut`, `handlers` from `@/lib/auth/auth`; `authConfig` from `@/lib/auth/auth.config`; `upsertUserByEmail(email: string, name?: string | null): Promise<{ id: string }>`. JWT token carries `token.userId: string`; `session.user.id` is set from it.

- [ ] **Step 1: Install the dependency**

```bash
cd /home/ncd/learnspaces/learning_english/web && npm install next-auth@beta && npm uninstall resend
```

- [ ] **Step 2: Write the failing test** — `web/src/lib/auth/upsert-user.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify FAIL** — `cd web && npm run test -- src/lib/auth/upsert-user.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** — `web/src/lib/auth/upsert-user.ts`:

```ts
import { db } from "@/lib/db";

/**
 * Finds-or-creates the app User for a Google sign-in, keyed by email —
 * preserves the old OTP flow's upsert-by-email semantics. `update: {}` so a
 * returning user's edited profile name is never clobbered by Google's.
 */
export async function upsertUserByEmail(
  email: string,
  name?: string | null
): Promise<{ id: string }> {
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: name ?? null },
    select: { id: true },
  });
}
```

- [ ] **Step 5: Run to verify PASS** (2 tests).

- [ ] **Step 6: Create `web/src/lib/auth/auth.config.ts`** (edge-safe — no Prisma imports):

```ts
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe NextAuth config shared by middleware.ts (edge runtime) and
 * auth.ts (node). MUST NOT import Prisma/@/lib/db — the Prisma-touching
 * jwt/session callbacks live only in auth.ts.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30d, matches old cookie
  pages: { signIn: "/login" },
  trustHost: true, // behind Cloudflare tunnel / docker
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user; // middleware: redirect to /login when false
    },
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 7: Create `web/src/lib/auth/auth.ts`** (node runtime):

```ts
import NextAuth from "next-auth";

import { authConfig } from "./auth.config";
import { upsertUserByEmail } from "./upsert-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, profile }) {
      // `profile` is only present on the sign-in request — upsert once,
      // then the userId rides the JWT for the session's lifetime.
      if (profile?.email) {
        const user = await upsertUserByEmail(profile.email, profile.name);
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
```

- [ ] **Step 8: Create `web/src/app/api/auth/[...nextauth]/route.ts`**:

```ts
import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 9: Typecheck** — `cd web && npx tsc --noEmit`. Expected: clean. (If `session.user.id` errors because DefaultSession lacks `id`, add `web/src/types/next-auth.d.ts`:

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
```

and re-run.)

- [ ] **Step 10: Commit**

```bash
cd /home/ncd/learnspaces/learning_english && git add web/src/lib/auth/auth.config.ts web/src/lib/auth/auth.ts web/src/lib/auth/upsert-user.ts web/src/lib/auth/upsert-user.test.ts "web/src/app/api/auth/[...nextauth]/route.ts" web/src/types/next-auth.d.ts web/package.json web/package-lock.json
git commit -m "feat(web): add NextAuth v5 with Google provider (JWT strategy, edge-safe config split)"
```

---

### Task 2: Wire session, middleware, login UI, logout — remove OTP UI

**Files:**
- Rewrite: `web/src/lib/auth/session.ts`, `web/src/middleware.ts`, `web/src/app/(auth)/login/page.tsx`
- Modify: `web/src/app/(app)/layout.tsx`, `web/src/components/LogoutButton.tsx`
- Delete: `web/src/app/(auth)/login/verify/page.tsx` (and its directory), `web/src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth/auth` (Task 1), `authConfig` from `@/lib/auth/auth.config`, `signIn`/`signOut` from `next-auth/react`.
- Produces: `getSessionUser(): Promise<User | null>` unchanged for all existing call sites.

- [ ] **Step 1: Rewrite `web/src/lib/auth/session.ts`** (full replacement):

```ts
import type { User } from "@prisma/client";

import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

/**
 * Returns the full Prisma User for the current NextAuth session, or null.
 * Same contract as the old cookie-JWT implementation — every page/API
 * call site and answers.test.ts's mock depend on this exact signature.
 */
export async function getSessionUser(): Promise<User | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}
```

- [ ] **Step 2: Rewrite `web/src/middleware.ts`** (full replacement — keep the existing `matcher` array VERBATIM from the current file):

```ts
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/auth.config";

// Edge runtime: authConfig has no Prisma imports; the `authorized`
// callback redirects unauthenticated requests to pages.signIn (/login).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/learn/:path*",
    "/ielts/:path*",
    "/listening/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
```

- [ ] **Step 3: Rewrite `web/src/app/(auth)/login/page.tsx`** — read the current file first and preserve its layout/styling shell (card, headings, Vietnamese copy); replace the email form + disabled Google button with one enabled button. Core logic:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

// ... keep the existing card/layout JSX shell ...
// Replace the <form> (email input + submit) and the disabled Google button with:

const [loading, setLoading] = useState(false);

<button
  type="button"
  disabled={loading}
  onClick={() => {
    setLoading(true);
    void signIn("google", { callbackUrl: "/dashboard" });
  }}
  // keep/adapt the existing Google-button classes, now enabled styling
>
  {loading ? "Đang chuyển đến Google..." : "Tiếp tục với Google"}
</button>
```

Remove all email/OTP state, the `request-otp` fetch, and the `router.push("/login/verify...")` navigation. Keep the Google "G" icon markup if the current button has one.

- [ ] **Step 4: Delete the verify page + logout route**

```bash
cd /home/ncd/learnspaces/learning_english/web
git rm -r "src/app/(auth)/login/verify" src/app/api/auth/logout
```

- [ ] **Step 5: Update `web/src/components/LogoutButton.tsx`** — read it first; replace its `fetch("/api/auth/logout", ...)` + redirect logic with:

```tsx
import { signOut } from "next-auth/react";
// in the click handler:
void signOut({ callbackUrl: "/login" });
```

Keep the component's props (`variant`, `className`) and Vietnamese label unchanged.

- [ ] **Step 6: Add onboarding redirect to `web/src/app/(app)/layout.tsx`** — it already fetches `getSessionUser()` and redirects to `/login` when null. Immediately after that guard, add:

```ts
if (user.goalType === null) redirect("/onboarding/name");
```

(This replaces the deleted verify page's `needsOnboarding` routing: a brand-new Google user landing on `/dashboard` gets sent to onboarding.)

- [ ] **Step 7: Typecheck + full test suite**

```bash
cd web && npx tsc --noEmit && npm run test
```

Expected: tsc clean. Tests: `otp.test.ts`/`email.test.ts` still exist until Task 3 — they must still pass (their modules are untouched so far). `answers.test.ts` may fail in `afterAll` teardown on Prisma DB connection if no local Postgres is running — pre-existing/environmental, not a regression.

- [ ] **Step 8: Commit**

```bash
cd /home/ncd/learnspaces/learning_english && git add -A web/src && git commit -m "feat(web): Google-only login UI, NextAuth middleware/session, drop OTP verify page"
```

---

### Task 3: Delete OTP backend + Prisma `OtpCode` model

**Files:**
- Delete: `web/src/app/api/auth/request-otp/route.ts`, `web/src/app/api/auth/verify-otp/route.ts`, `web/src/lib/auth/otp.ts`, `web/src/lib/auth/otp.test.ts`, `web/src/lib/auth/email.ts`, `web/src/lib/auth/email.test.ts`
- Modify: `web/prisma/schema.prisma` (remove the whole `model OtpCode { ... }` block)

- [ ] **Step 1: Delete files**

```bash
cd /home/ncd/learnspaces/learning_english/web
git rm -r src/app/api/auth/request-otp src/app/api/auth/verify-otp
git rm src/lib/auth/otp.ts src/lib/auth/otp.test.ts src/lib/auth/email.ts src/lib/auth/email.test.ts
```

- [ ] **Step 2: Remove the `OtpCode` model** from `web/prisma/schema.prisma` (the standalone model with `email`, `codeHash`, `expiresAt`, `attempts`, `consumedAt`, `createdAt`, `@@index([email, createdAt])` — no relations to touch).

- [ ] **Step 3: Create the migration**

```bash
cd /home/ncd/learnspaces/learning_english
docker compose up -d db   # ensure Postgres is up (or skip if npm-dev local PG already running)
cd web && npx prisma migrate dev --name drop_otp_code
```

Expected: migration drops table `OtpCode`. If no DB is reachable: `npx prisma migrate dev --create-only --name drop_otp_code`, then report BLOCKED-partial so the controller surfaces it.

- [ ] **Step 4: Verify no dangling references**

```bash
grep -rn -e "OtpCode" -e "sendOtpEmail" -e "issueOtp" -e "verifyOtp" -e "request-otp" -e "verify-otp" \
  /home/ncd/learnspaces/learning_english/web/src /home/ncd/learnspaces/learning_english/web/prisma/schema.prisma
```

Expected: zero matches. Then `npx tsc --noEmit` (clean) and `npm run test` (remaining suites pass; same `answers.test.ts` DB-teardown caveat).

- [ ] **Step 5: Commit**

```bash
cd /home/ncd/learnspaces/learning_english && git add -A web && git commit -m "feat(web)!: remove email-OTP auth backend and OtpCode model"
```

---

### Task 4: Env plumbing + docs — new AUTH_* contract, purge Resend/OTP/SESSION_SECRET

**Files:**
- Modify: `docker-compose.yml` (web service env), `.env.example` (root), `web/.env.example`, `Makefile` (if any stale help text), `web/README.md`
- Delete: `docs/superpowers/plans/2026-07-08-real-otp-email-resend.md`

(Reminder: `.env.example` files are Read-tool-blocked — use Bash `cat` to read and heredoc to rewrite.)

- [ ] **Step 1: `docker-compose.yml`** — in the `web` service `environment:` block, replace

```yaml
      SESSION_SECRET: ${SESSION_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      OTP_EMAIL_FROM: ${OTP_EMAIL_FROM:-}
      SESSION_COOKIE_SECURE: ${SESSION_COOKIE_SECURE:-false}
```

with:

```yaml
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID}
      AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET}
      AUTH_URL: ${AUTH_URL:-http://localhost:3000}
```

Validate: `docker compose config --quiet` → exit 0.

- [ ] **Step 2: Root `.env.example`** — read current content via `cat`, then rewrite via heredoc: remove the Resend block (`RESEND_API_KEY`, `OTP_EMAIL_FROM` + comments) and `SESSION_SECRET`/`SESSION_COOKIE_SECURE` lines; add:

```bash
# NextAuth (Auth.js) — Google OAuth login.
# AUTH_SECRET: openssl rand -hex 32 (may reuse the old SESSION_SECRET value)
# AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET: Google Cloud Console → APIs & Services
#   → Credentials → OAuth 2.0 Client ID (Web application). Authorized redirect
#   URI: <AUTH_URL>/api/auth/callback/google
# AUTH_URL: public origin of the app (http://localhost:3000 locally,
#   https://<your-tunnel-domain> behind the Cloudflare tunnel)
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_URL=http://localhost:3000
```

Preserve all non-auth lines (Postgres, ports, tunnel token) verbatim.

- [ ] **Step 3: `web/.env.example`** — same treatment: drop `SESSION_SECRET`, `SESSION_COOKIE_SECURE`, `RESEND_API_KEY`, `OTP_EMAIL_FROM`; add the same four `AUTH_*` lines (with `AUTH_URL="http://localhost:3000"`).

- [ ] **Step 4: `Makefile`** — grep for `OTP`, `Resend`, `SESSION_SECRET` in help text; update/remove any stale lines.

- [ ] **Step 5: `web/README.md`** — rewrite the auth-related passages: line 4's "passwordless email OTP auth" → "Google OAuth (NextAuth v5)"; the "Current deployment status" Resend bullets and numbered production step 2 → Google OAuth Client setup; the env-vars table → rows for `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` (drop `SESSION_SECRET`/`RESEND_API_KEY`/`OTP_EMAIL_FROM` rows); the middleware note ("only reads SESSION_SECRET and only imports jose") → "uses NextAuth's edge-safe `auth.config.ts` (no Prisma import)".

- [ ] **Step 6: Delete the old OTP plan file** (explicit user request — overrides the frozen-docs convention for this one file):

```bash
cd /home/ncd/learnspaces/learning_english && git rm docs/superpowers/plans/2026-07-08-real-otp-email-resend.md
```

- [ ] **Step 7: Global purge check**

```bash
grep -rn -e "OTP_DEV_ECHO" -e "RESEND_API_KEY" -e "OTP_EMAIL_FROM" -e "SESSION_SECRET" -e "SESSION_COOKIE_SECURE" \
  /home/ncd/learnspaces/learning_english \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude-dir=docs --exclude-dir=.superpowers --exclude-dir=.claude
```

Expected: matches only in gitignored `.env` / `web/.env.local` (cleaned in Task 6) and unrelated untracked scratch dirs (`abc/`, `fix_some_screen/`, `\`, `webapp_design/` — not this plan's concern). Zero matches in tracked code/config/docs.

- [ ] **Step 8: Commit**

```bash
cd /home/ncd/learnspaces/learning_english
git add docker-compose.yml .env.example web/.env.example Makefile web/README.md
git commit -m "chore: switch env/docs to NextAuth Google OAuth contract, remove Resend/OTP plan"
```

(The `git rm` from Step 6 is already staged.)

---

### Task 5: Local smoke build

- [ ] **Step 1:** `cd web && npx tsc --noEmit && npm run lint && npm run test` — all clean (same `answers.test.ts` DB caveat if Postgres is down).
- [ ] **Step 2:** `npm run build` — production build succeeds (catches edge-bundle violations: if the build errors about Prisma in middleware, the config split leaked — fix before proceeding).
- [ ] **Step 3: Commit any fixes** that surfaced (or nothing to commit).

---

### Task 6: Manual setup — Google Cloud Console + real secrets (USER does this, agent assists env files via Bash)

- [ ] **Step 1: Create the OAuth client** — https://console.cloud.google.com → chọn/tạo project → **APIs & Services → OAuth consent screen** (External, điền app name + email, thêm chính bạn làm test user nếu ở chế độ Testing) → **Credentials → Create Credentials → OAuth client ID → Web application**:
  - Authorized JavaScript origins: `http://localhost:3000` và `https://<domain-tunnel-của-bạn>`
  - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` và `https://<domain-tunnel>/api/auth/callback/google`
  - Copy **Client ID** và **Client secret**.

- [ ] **Step 2: Fill env files** (gitignored — via Bash, never committed): trong root `.env` và `web/.env.local`: xóa `RESEND_API_KEY`, `OTP_EMAIL_FROM`, `OTP_DEV_ECHO`, `SESSION_COOKIE_SECURE`; đổi `SESSION_SECRET=...` thành `AUTH_SECRET=...` (giữ nguyên giá trị); thêm `AUTH_GOOGLE_ID=...`, `AUTH_GOOGLE_SECRET=...`, `AUTH_URL=http://localhost:3000` (root `.env` dùng URL tunnel nếu chạy qua tunnel).

- [ ] **Step 3: Restart** — `docker compose up -d --build web` (hoặc restart `npm run dev`).

---

### Task 7: End-to-end verification

- [ ] **Step 1:** Mở `http://localhost:3000/login` → chỉ còn nút **"Tiếp tục với Google"** (không còn form nhập email) → bấm → chuyển đến màn hình chọn tài khoản Google.
- [ ] **Step 2:** Chọn tài khoản Gmail → quay về app. User cũ (đã có `goalType`) → `/dashboard`; user mới → `/onboarding/name`.
- [ ] **Step 3:** Kiểm tra DB: `User` row tồn tại đúng email, không tạo trùng (login lần 2 không thêm row).
- [ ] **Step 4:** `/login/verify` và `/api/auth/request-otp` trả 404.
- [ ] **Step 5:** Đăng xuất ở Settings → quay về `/login`; truy cập `/dashboard` khi chưa đăng nhập → middleware redirect về `/login`.

---

## Self-Review

- **Spec coverage:** Google OAuth login (Tasks 1-2, 6-7); bỏ hẳn OTP — code (Task 3), UI (Task 2), env/docs (Task 4), DB model (Task 3), secrets (Task 6); xóa plan OTP cũ (Task 4 Step 6). ✓
- **Placeholder scan:** login-page/LogoutButton steps intentionally say "read the current file, preserve the shell" because the implementer must not blindly overwrite existing styled JSX — the replacement logic is given in full; all other code steps are complete. ✓
- **Type consistency:** `upsertUserByEmail(email, name?) → {id}` used identically in Task 1 test/impl/auth.ts; `getSessionUser(): Promise<User|null>` unchanged; `token.userId`/`session.user.id` consistent between auth.ts and session.ts; env names `AUTH_SECRET/AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET/AUTH_URL` identical across compose, env examples, README, config. ✓
