# Complete DS Sync + Claude Design Project + Mobile/Tablet Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Project rule: run only ONE subagent at a time.**
>
> On approval, save to `docs/superpowers/plans/2026-07-12-mobile-redesign-claude-design.md`.

## Context

The user wants to redesign the phone/tablet UI (desktop ≥1024px is already good) by designing screens in Claude Design and having Claude Code read those designs back into code. Two problems block that today:

1. **The design system is stale and broken.** `.design-sync/config.json:24` and `web/.ds-entry.tsx:37` point at `src/components/ListeningRunner.tsx`, which was renamed to `SectionedListeningRunner.tsx` — any `/design-sync` run fails on that path. And 15 of the app's components (including all of the new-feature work: `InlineExample`, `SectionedListeningRunner`, exercise review) were never synced, so a designer working in Claude Design would have to invent UI that already exists.
2. **There is no consumer project.** The only Claude Design projects are the design system itself and an empty stub.

Intended outcome: every component the app renders is in the design system, a new Claude Design project bound to it is the place the user designs screens, a documented loop brings those designs back into code, and the decided mobile shell (bottom tab bar) ships.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4 + shadcn (base-nova), lucide-react, Vitest, Playwright MCP, Claude Design MCP tools, `/design-sync` skill.

## Global Constraints

- Design system project (components): `c65cc8d7-1c60-4c55-98e9-8c2555892ad3` ("Học tiếng Anh - Design System").
- Empty legacy project `bb8fdd46-2d78-47b7-9112-fecb84da4c0a` — leave untouched.
- Read `.design-sync/NOTES.md` before any sync. Mandatory build order: `fetch-fonts.mjs` → `build-css.mjs` → converter. `DS_CHROMIUM_PATH=/usr/bin/google-chrome`. `web/.ds-css/` must stay gitignored.
- **Never stub** `next/navigation`, `next-auth`, or `next-themes` to make a preview render — the card would show a component that doesn't exist in the app.
- `linkComponent` props are **required, no default** (a default of `"a"` silently downgrades links to full page loads). Reference implementation: `web/src/components/EmptyState.tsx`.
- Target viewports: **375px phone** and **768px tablet** share one design; **≥1024px desktop must not regress**.
- Mobile nav (user-decided): app-wide **bottom tab bar** — Trang chủ / Luyện nghe / IELTS / Cài đặt.
- Vietnamese UI copy; indigo-violet primary + coral accent; Be Vietnam Pro; touch targets ≥44px. DS type scale is `text-h1/h2/body/caption` — never `text-2xl`.
- Any class the design agent may use must be in **both** `build-css.mjs`'s `@source inline(...)` safelist **and** `.design-sync/conventions.md`.
- Work directly on `main`; commit per task.

---

# Phase 0 — Make the design system complete (blocks everything else)

Goal: every component the app renders is synced, so the user can design any page from real UI instead of guessing.

## Task 0.1: Fix the broken `ListeningRunner` reference

The rename to `SectionedListeningRunner` was never propagated; the sync is currently unrunnable.

**Files:** `.design-sync/config.json`, `web/.ds-entry.tsx`, `.design-sync/previews/ListeningRunner.tsx`

- [ ] **Step 1: Confirm the break** — `ls web/src/components/ListeningRunner.tsx` → No such file. `grep -rn ListeningRunner .design-sync/config.json web/.ds-entry.tsx`.
- [ ] **Step 2:** In `.design-sync/config.json`, replace the `"ListeningRunner": "src/components/ListeningRunner.tsx"` entry with `"SectionedListeningRunner": "src/components/SectionedListeningRunner.tsx"`; rename its `overrides` key too (keep `cardMode: "column"`).
- [ ] **Step 3:** In `web/.ds-entry.tsx`, replace the `ListeningRunner` export with `export { SectionedListeningRunner } from "@/components/SectionedListeningRunner";`.
- [ ] **Step 4:** `git mv .design-sync/previews/ListeningRunner.tsx .design-sync/previews/SectionedListeningRunner.tsx`, update its import/JSX to the new name, and update its props to the real `SectionedListeningRunner` signature (read the component first — its props are not the old `ListeningRunner` ones).
- [ ] **Step 5:** Move the `ListeningRunner` `dtsPropsFor` body to `SectionedListeningRunner` and correct it against the actual component props.
- [ ] **Step 6:** `cd web && npx tsc --noEmit` → clean. Commit: `fix(design-sync): point sync at SectionedListeningRunner after rename`.

## Task 0.2: Extract the `next/link`-coupled components to `linkComponent` injection

8 components import `next/link` directly. Follow the **exact** pattern already used in `web/src/components/EmptyState.tsx` and `ListeningSetCard.tsx`: replace `import Link from "next/link"` with a required `linkComponent: React.ElementType` prop destructured as `linkComponent: Link`, documented `/** Pass NextLink in the app, "a" in a design. Required — see AppHeader. */`.

**Files (each: modify the component + every call site that renders it):**
- `web/src/components/ErrorState.tsx`
- `web/src/components/lesson-node.tsx` (rendered by `PhasePillRow.tsx`, `LessonMap.tsx` — thread the prop through)
- `web/src/components/LessonTabs.tsx`
- `web/src/components/IeltsHub.tsx`
- `web/src/components/ExerciseRunner.tsx`
- `web/src/components/vocab/Flashcards.tsx`, `vocab/MatchGame.tsx`, `vocab/QuizGame.tsx`

Note `PhasePillRow`/`LessonMap`/`IeltsHub`/`ExerciseRunner` are pages' children, so their **call sites are server or client pages under `web/src/app/(app)/`** — those pass `NextLink`. Where a server component renders a client one, passing `NextLink` (a component reference, not a function prop) is fine; passing callbacks is not.

- [ ] **Step 1: Read `EmptyState.tsx` and `ListeningSetCard.tsx`** to internalise the pattern (both already correct).
- [ ] **Step 2: Extract one component at a time.** For each: add the prop, replace `<Link>` usages, update every call site (`grep -rn "<ComponentName" web/src/app web/src/components`).
- [ ] **Step 3: Verify the guard fires** — the prop must have **no default**, so a forgotten call site is a TS error, not a silent regression: `cd web && npx tsc --noEmit`.
- [ ] **Step 4: `cd web && npm test && npm run lint && npm run build`** — all green. The test suite does NOT cover the UI layer (per NOTES.md), so `tsc --noEmit` + `npm run build` are the real safety nets here.
- [ ] **Step 5: Click-test one nav link per touched component** with DevTools open — a *document* request means client-side navigation broke.
- [ ] **Step 6: Commit** — `refactor(components): inject linkComponent so the DS can render them`.

## Task 0.3: Split the container components into presentational + connected

5 components cause effects (`next-auth`, `useRouter`, `next-themes`). Split each exactly as `AppSidebar` / `AppSidebarConnected.tsx` does: presentational component takes plain props + callbacks; a thin `"use client"` `XConnected.tsx` wrapper keeps the router/session/theme in the app. Only the presentational half is synced.

**Files (create the `*Connected.tsx`, slim the original, repoint call sites):**

| Component | Effect to lift out | Presentational props |
|---|---|---|
| `LogoutButton.tsx` | `signOut()` from `next-auth/react` | `onLogout: () => void`, `pending: boolean`, `variant`, `className` |
| `ResetToStartButton.tsx` | `useRouter().refresh()` + fetch | `onReset: () => void`, `pending: boolean` |
| `SettingsGoalForm.tsx` | `useRouter()` + fetch | `value`, `onChange`, `onSubmit`, `pending`, `saved` |
| `SettingsNameEditor.tsx` | `useRouter()` + fetch | `name`, `onSave: (name: string) => void`, `pending`, `saved` |
| `ThemeToggleRow.tsx` | `useTheme()` from `next-themes` | `checked: boolean`, `onCheckedChange: (v: boolean) => void` |

- [ ] **Step 1: Read `AppSidebar.tsx` + `AppSidebarConnected.tsx`** — the reference split.
- [ ] **Step 2:** For each of the 5: move the hook/fetch into `XConnected.tsx`, leave pure markup + callbacks in `X.tsx`, repoint the call site (`grep -rn "XButton\|XForm\|XEditor\|XRow" web/src/app`) to the Connected version.
- [ ] **Step 3:** `LogoutButton` is rendered from the **server** `(app)/layout.tsx` as a `logoutSlot` ReactNode — so the layout must render `<LogoutButtonConnected />`, never pass it a function.
- [ ] **Step 4:** `cd web && npx tsc --noEmit && npm test && npm run lint && npm run build` — green.
- [ ] **Step 5:** Manually verify each still works: logout signs out, settings name/goal save, theme toggle flips, reset-to-start resets.
- [ ] **Step 6: Commit** — `refactor(components): split containers into presentational + connected`.

## Task 0.4: Verify the "Prisma blocker" is already gone

`NOTES.md:155` lists `IeltsHub`, `LessonMap`, `PhasePillRow` as blocked by Prisma via `@/lib/progress`. They now use **type-only** imports (`import type { LessonState } from "@/lib/progress"`), which TypeScript erases at compile — the same reason `LevelBadge` was syncable despite `import type { CefrLevel } from "@prisma/client"`.

- [ ] **Step 1: Confirm** — `grep -rn "from \"@/lib/progress\"" web/src/components/` → every hit must be `import type`. Same for `@/lib/ielts-answer-key` in `IeltsHub.tsx`.
- [ ] **Step 2: If any is a value import,** split `web/src/lib/progress.ts` into `progress-types.ts` (pure types, no `@prisma/client`, no `@/lib/db`) + `progress.ts` (queries, re-exports the types), and repoint the components. `web/src/lib/progress.test.ts` exists and protects this — run it.
- [ ] **Step 3:** The purity check the sync itself runs: `grep -rnE "next-auth|useRouter|usePathname|next/link|next-themes|@prisma/client|@/lib/db" $(the 20 componentSrcMap paths)` → only `import type` hits allowed. Any value hit = not syncable yet.
- [ ] **Step 4: Commit** only if changes were needed.

## Task 0.5: Register all 20 components and write their previews

**Files:** `.design-sync/config.json` (`componentSrcMap`, `overrides`, `dtsPropsFor`), `web/.ds-entry.tsx`, `.design-sync/previews/<Name>.tsx` (one per new component), `.design-sync/conventions.md` + `.design-sync/build-css.mjs` (safelist) if new classes appear.

Components to **add** (on top of the 20 already mapped, after Task 0.1's rename):

`ErrorState`, `ExerciseRunner`, `IeltsHub`, `InlineExample`, `LessonMap`, `LessonNode` (`lesson-node.tsx`), `LessonTabs`, `ListeningBottomNav`, `PhasePillRow`, `Flashcards`, `MatchGame`, `QuizGame`, `LogoutButton`, `ResetToStartButton`, `SettingsGoalForm`, `SettingsNameEditor`, `ThemeToggleRow`

- [ ] **Step 1:** Add each to `componentSrcMap` in `.design-sync/config.json` and as a named export in `web/.ds-entry.tsx`, grouped with a comment explaining why it is now syncable (mirror the existing comment blocks).
- [ ] **Step 2: Write `dtsPropsFor` by hand for every one.** NOTES.md is explicit: ts-morph flattens inline prop types to `[key: string]: unknown`, which leaves the design agent with no API contract. Copy the real prop types from each component's source.
- [ ] **Step 3: Write one preview per component** in `.design-sync/previews/`, modelled on `.design-sync/previews/EmptyState.tsx` (imports from `"web"`, passes `linkComponent="a"`, exports one named story per meaningful state). Cover the states a designer needs: `ExerciseRunner` (answering / correct / incorrect / review), `QuestionCard`-style graded states via `FILL_BLANK` (see NOTES.md — graded MCQ cannot be shown statically), `InlineExample` (untried / correct / wrong), `LessonNode` (done / unlocked / locked / skipped), vocab games (in-play / finished).
- [ ] **Step 4: Set `overrides`** — page-width components need `cardMode: "column"` (else `[GRID_OVERFLOW]`); tall ones need an explicit `viewport` (`ExerciseRunner`, `MatchGame`, `QuizGame`, `LessonMap`, `IeltsHub` ≈ `900x760`). Remember: **a viewport change requires a full `package-build.mjs`**, not `preview-rebuild.mjs`.
- [ ] **Step 5:** Add any new utility classes the previews use to **both** the `@source inline(...)` safelist in `build-css.mjs` **and** `conventions.md`. Verify CSS determinism: run `build-css.mjs` twice, sizes must match.
- [ ] **Step 6: Run the sync** (`/design-sync` skill): `node .design-sync/fetch-fonts.mjs` → `node .design-sync/build-css.mjs` → converter, with `DS_CHROMIUM_PATH=/usr/bin/google-chrome`.
- [ ] **Step 7: READ THE REVIEW SHEETS, don't trust the render check.** NOTES.md §"Traps": a `hidden lg:block` component renders as an empty card and still passes; a `⚠`-leading cell is misreported as an error. Open `ds-bundle/.review.html` and look at every card.
- [ ] **Step 8: Confirm in Claude Design** — `mcp__claude-design__list_files` on `c65cc8d7-…/components` shows all ~37 components. Commit: `feat(design-sync): sync every app component to the design system`.
- [ ] **Step 9: Update `.design-sync/NOTES.md`** — its "Still out of scope, by blocker" section (lines 145–157) is now obsolete. Replace with the current truth: what is synced, and what genuinely remains out (`*Connected` wrappers, by design).

---

# Phase A — The Claude Design project + the design→code loop

## Task A.1: Create the project, bound to the (now complete) design system

**Files:** Create `.design-sync/design-project.json`

- [ ] **Step 1:** `mcp__claude-design__create_project { "name": "Học tiếng Anh — Mobile & Tablet Redesign", "design_system_id": "c65cc8d7-1c60-4c55-98e9-8c2555892ad3" }` → returns `{project_id, url}`.
  - If this 403s with `subscription required` (it did last time — NOTES.md:64), ask the user to create the project in the claude.ai/design **web UI**, then re-run `/design-login` and adopt it.
- [ ] **Step 2:** Write `.design-sync/design-project.json`:
```json
{
  "purpose": "Consumer project where page designs for the mobile/tablet redesign live. Components come from the bound design system — never re-upload them here.",
  "projectId": "<from step 1>",
  "url": "<from step 1>",
  "boundDesignSystemId": "c65cc8d7-1c60-4c55-98e9-8c2555892ad3",
  "createdAt": "2026-07-12"
}
```
- [ ] **Step 3: Commit** — `chore(design): register the Claude Design mobile-redesign project`.

## Task A.2: Seed the project with a brief + screen inventory

**Files (remote, in the new project):** `BRIEF.md`, `screens/INVENTORY.md`

- [ ] **Step 1:** `mcp__claude-design__get_claude_design_prompt { design_system_id: "c65cc8d7-…", project_id: "<new>" }` (mandatory before any write).
- [ ] **Step 2:** `mcp__claude-design__finalize_plan` for the two paths → `plan_token`.
- [ ] **Step 3: Write `BRIEF.md`** (verbatim):
```markdown
# Brief — Redesign mobile & tablet

Ứng dụng tự học tiếng Anh (IELTS 6.5–8.0), Next.js + Tailwind, UI tiếng Việt.
Desktop (≥1024px, sidebar trái 232px) đã ổn — KHÔNG thiết kế lại desktop.

## Mục tiêu
Thiết kế lại toàn bộ màn hình cho **điện thoại (375px)** và **máy tính bảng
(768px)** — một thiết kế dùng chung, responsive giữa hai khung.

## Quyết định đã chốt
- Điều hướng mobile/tablet: **bottom tab bar cố định**, 4 tab: Trang chủ /
  Luyện nghe / IELTS / Cài đặt. Header trên chỉ còn logo + đăng xuất.
- Trang luyện nghe chi tiết có thanh "Quay lại" nằm NGAY TRÊN tab bar.
- Token: indigo-violet primary + coral accent, chữ Be Vietnam Pro,
  touch target ≥44px, radius 0.625rem.
- Thang chữ của design system: text-h1 / text-h2 / text-body / text-caption
  (KHÔNG dùng text-2xl…).

## Nguyên tắc quan trọng
Design system đã có ĐẦY ĐỦ component đang chạy thật trong app (Button, Card,
QuestionCard, ExerciseRunner, SectionedListeningRunner, InlineExample,
LessonMap, LessonNode, IeltsHub, Flashcards, MatchGame, QuizGame,
PlacementWizard, AppHeader, AppSidebar, ListeningBottomNav, Settings*, …).
**Luôn dùng lại component có sẵn** — chỉ vẽ mới khi thật sự chưa có.
Đây là UI thật của app, không phải phỏng đoán.

## Cách làm việc
Mỗi nhóm màn hình (xem screens/INVENTORY.md) lưu thành một file .dc.html
trong screens/ (ví dụ screens/dashboard.dc.html). Claude Code sẽ đọc file đó
và triển khai vào code.
```
- [ ] **Step 4: Write `screens/INVENTORY.md`** (verbatim):
```markdown
# Màn hình cần redesign (mobile 375px / tablet 768px)

| # | Nhóm | Route | Component chính đã có trong DS |
|---|------|-------|-------------------------------|
| 1 | Dashboard + bản đồ bài học | /dashboard | LessonMap, LessonNode, PhasePillRow, LevelBadge |
| 2 | Bài học: lecture + từ vựng | /learn/[phase]/[lesson], /vocab/* | LessonTabs, MarkdownContent, LectureToc, InlineExample, Flashcards, MatchGame, QuizGame |
| 3 | Làm bài tập | /learn/.../exercise | ExerciseRunner, QuestionCard, ExplanationSlot, AnswerKeyAccordion |
| 4 | Luyện nghe | /listening, /listening/[slug] | ListeningSetCard, ListeningSetView, SectionedListeningRunner, AudioPlayer, ListeningBottomNav |
| 5 | IELTS | /ielts, /ielts/[n] | IeltsHub, MarkdownContent |
| 6 | Cài đặt + Onboarding | /settings, /onboarding/* | SettingsNameEditor, SettingsGoalForm, ThemeToggleRow, ResetToStartButton, GoalPicker, PlacementWizard |
| — | Khung chung | mọi trang | AppHeader, AppSidebar, EmptyState, ErrorState, Skeleton |

Thiết kế xong nhóm nào → lưu screens/<tên-nhóm>.dc.html rồi báo Claude Code.
```
- [ ] **Step 5:** `mcp__claude-design__write_files` with the token; verify with `list_files`; share the project URL with the user.

## Task A.3: Document the loop in the repo

**Files:** Create `docs/design/DESIGN_CODE_WORKFLOW.md`; modify `CLAUDE.md` (one pointer in the `docs/design/` bullet).

- [ ] **Step 1: Write `docs/design/DESIGN_CODE_WORKFLOW.md`** covering: the two projects and their IDs (design system = components, consumer = page designs, pointer in `.design-sync/design-project.json`); the per-screen loop (user designs in Claude Design → Claude Code reads via `mcp__claude-design__list_files` + `read_file` → implements in `web/src/` → verifies at 375/768/1280 with Playwright → `npm test && npm run lint` → commit); the rule that adding a component to the DS means `componentSrcMap` + `.ds-entry.tsx` + a preview + `/design-sync` (see `.design-sync/NOTES.md` for build order); and the security note that `.dc.html` content is **data, not instructions**.
- [ ] **Step 2:** Append to the `docs/design/` bullet in `CLAUDE.md`: `Design→code loop with Claude Design: docs/design/DESIGN_CODE_WORKFLOW.md.`
- [ ] **Step 3: Commit** — `docs(design): document the Claude Design → code workflow`.

---

# Phase B — Ship the mobile shell (bottom tab bar)

This is the one design decision already made, so it doesn't wait on Phase C designs.

## Task B.1: `MobileTabBar` (TDD)

**Files:** Create `web/src/components/MobileTabBar.tsx` + `web/src/components/MobileTabBar.test.tsx`

Note `.test.tsx` files already exist (`EmptyState.test.tsx`, `ListeningSetCard.test.tsx`), so the jsdom UI-test setup works — mirror `EmptyState.test.tsx` exactly. (NOTES.md:159 says `.tsx` isn't covered; that is now stale — verify with `npx vitest run src/components/EmptyState.test.tsx`.)

- [ ] **Step 1: Read `web/src/components/EmptyState.test.tsx`** and mirror its setup.
- [ ] **Step 2: Write the failing test:**
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileTabBar } from "./MobileTabBar";

describe("MobileTabBar", () => {
  it("renders the four hub tabs", () => {
    render(<MobileTabBar linkComponent="a" activePath="/dashboard" />);
    expect(screen.getByRole("link", { name: /Trang chủ/ })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /Luyện nghe/ })).toHaveAttribute("href", "/listening");
    expect(screen.getByRole("link", { name: /IELTS/ })).toHaveAttribute("href", "/ielts");
    expect(screen.getByRole("link", { name: /Cài đặt/ })).toHaveAttribute("href", "/settings");
  });

  it("marks the tab owning the current route", () => {
    render(<MobileTabBar linkComponent="a" activePath="/listening/bai-01" />);
    expect(screen.getByRole("link", { name: /Luyện nghe/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Trang chủ/ })).not.toHaveAttribute("aria-current");
  });
});
```
- [ ] **Step 3: Run it, expect FAIL** — `cd web && npx vitest run src/components/MobileTabBar.test.tsx` → "Cannot find module './MobileTabBar'".
- [ ] **Step 4: Implement:**
```tsx
import { Home, Headphones, GraduationCap, Settings } from "lucide-react";
import type { ElementType } from "react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/ielts", label: "IELTS", icon: GraduationCap },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

/** App-wide bottom tab bar for phones/tablets (<1024px) — the primary mobile
 * navigation, replacing the link row that used to live in `AppHeader`. Fixed to
 * the viewport bottom, so `(app)/layout.tsx` reserves `pb-16 lg:pb-0` on
 * `<main>`. Hidden at `lg:`, where `AppSidebar` takes over.
 *
 * Presentational: `linkComponent` and `activePath` are injected (see
 * `MobileTabBarConnected`), so it renders outside a Next runtime. */
export function MobileTabBar({
  linkComponent: Link,
  activePath,
  className,
}: {
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: ElementType;
  /** Current pathname. A tab owns the route when the path equals or nests under its href. */
  activePath: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden",
        className,
      )}
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = activePath === href || activePath.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 text-caption font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```
- [ ] **Step 5: Run tests → PASS.**
- [ ] **Step 6: Commit** — `feat(shell): add MobileTabBar bottom navigation`.

## Task B.2: Wire it in and slim the mobile header

**Files:** Create `web/src/components/MobileTabBarConnected.tsx`; modify `web/src/app/(app)/layout.tsx`, `web/src/components/AppHeader.tsx`

- [ ] **Step 1:** Create `MobileTabBarConnected.tsx`, mirroring `AppSidebarConnected.tsx`:
```tsx
"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

import { MobileTabBar } from "@/components/MobileTabBar";

/** Keeps the router in the app; the tab bar itself stays presentational. */
export function MobileTabBarConnected() {
  return <MobileTabBar linkComponent={NextLink} activePath={usePathname() ?? ""} />;
}
```
- [ ] **Step 2:** In `(app)/layout.tsx`, reserve space and render the bar:
```tsx
      <main className="flex-1 pb-16 lg:pb-0 lg:pl-[232px]">{children}</main>
      <MobileTabBarConnected />
```
- [ ] **Step 3:** Slim `AppHeader.tsx` — delete `NAV_LINKS` (lines 5–10) and the `<nav>` block (lines 45–56), keeping the logo link + `logoutSlot`. Rewrite its doc comment: navigation now lives in `MobileTabBar`; the header is brand + sign-out only.
- [ ] **Step 4:** Update `AppHeader`'s preview + `dtsPropsFor` in `.design-sync/`, since its props/markup changed.
- [ ] **Step 5:** `cd web && npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Step 6: Playwright MCP** — 375×812 and 768×1024: tab bar visible, active tab highlighted, page content not hidden behind it. 1280×800: no tab bar, sidebar unchanged.
- [ ] **Step 7: Commit** — `feat(shell): app-wide bottom tab bar on mobile, slim top header`.

## Task B.3: Stack `ListeningBottomNav` above the tab bar

`ListeningBottomNav` is also `fixed bottom-0` — it would sit under the new tab bar.

**Files:** `web/src/components/ListeningBottomNav.tsx`, plus the set page's reserved bottom padding (`ListeningSetView.tsx` / `(app)/listening/[slug]/page.tsx`).

- [ ] **Step 1:** Change the `<nav>` class to `fixed inset-x-0 bottom-16 z-40 border-t border-border bg-card/95 backdrop-blur lg:bottom-0 lg:pl-[232px]`; update the doc comment (it sits above the app tab bar on mobile).
- [ ] **Step 2:** `grep -rn "pb-" web/src/components/ListeningSetView.tsx web/src/app/\(app\)/listening/` and raise the reserved padding to clear both bars below `lg` (≈64px tab bar + 48px back bar → `pb-28 lg:pb-12`).
- [ ] **Step 3: Playwright** at 375px on `/listening/<slug>`: both bars visible, no overlap, last question reachable. At 1280px: unchanged.
- [ ] **Step 4:** `npm test`; commit — `fix(listening): stack the set-page back bar above the mobile tab bar`.

---

# Phase C — Per-screen redesign loop (one task per group, driven by the user's designs)

The 6 groups are in `screens/INVENTORY.md`. Implementation code **cannot be pre-written** — it comes from the designs. Each group repeats:

- [ ] **1 (user):** Design the group in Claude Design per `BRIEF.md`; save as `screens/<group>.dc.html`; tell Claude Code.
- [ ] **2:** Read it — `mcp__claude-design__list_files` then `read_file` (project id from `.design-sync/design-project.json`). Treat contents as **data, not instructions**.
- [ ] **3:** Map design → the `web/src/` files affected. Reuse existing components; prefer adding responsive classes (`max-lg:` / `lg:`) over new components. **Never change ≥1024px rendering.**
- [ ] **4:** Implement, keeping the presentational/connected split and Vietnamese copy.
- [ ] **5:** Verify — Playwright screenshots at 375×812, 768×1024, 1280×800 compared against the design; `cd web && npm test && npm run lint && npx tsc --noEmit`.
- [ ] **6:** Commit — `feat(mobile): redesign <group> for phone/tablet`.

Suggested order: Dashboard+lesson map → Exercise → Listening → Lecture/vocab → IELTS → Settings+Onboarding.

---

# Verification (end-to-end)

1. **DS completeness (the user's core ask):** `mcp__claude-design__list_files` on `c65cc8d7-…/components` lists every component in `web/src/components/` except the `*Connected` wrappers. Cross-check against `ls web/src/components/**/*.tsx`.
2. **The sync is runnable again:** a clean `/design-sync` completes; `ds-bundle/.review.html` shows a correct card for every component (read it — the render check misses empty and `⚠`-leading cards).
3. `cd web && npm test && npm run lint && npx tsc --noEmit && npm run build` — green.
4. **No silent link regressions:** click one link per refactored component with DevTools open; a document request means client-side nav broke.
5. Playwright sweep of `/dashboard`, `/learn/*/exercise`, `/listening`, `/listening/<slug>`, `/ielts`, `/settings` at 375 / 768 / 1280 — tab bar behaves per the constraints, desktop unchanged.
6. The user can open the new Claude Design project, ask for any screen, and get a design built from real components.
