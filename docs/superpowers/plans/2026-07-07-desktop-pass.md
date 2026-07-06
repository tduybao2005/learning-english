# "Học tiếng Anh" Desktop (≥1024px) Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **This repo's standing rule:** never run subagents in parallel — at most one at a time.

**Goal:** Give every screen of the Next.js app in `web/` a desktop (≥1024px) layout that matches the reference mockups in `webapp_design/webapp-export/screens-desktop/` (`01-d.png` … `10-d.png`) — UI/layout only, zero changes to data-fetching or business logic.

**Architecture:** The mobile-first restyle is already committed (indigo-violet tokens, Be Vietnam Pro, sidebar shell, per-screen styling — see git log `7c1276e`…`6423e3b`). This pass adds `lg:` treatments on top: split-screen auth/result, 2-column placement & listening, a lecture TOC rail, focus-mode overlays for the exercise runner and vocab games, wider grids (band chips 6-col, IELTS 8-col), and one agreed UX change (skill tabs on the IELTS hub per screen 09-d). Below 1024px everything must render exactly as it does today.

**Tech Stack:** Next.js 15.5 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui on `@base-ui/react` (NOT Radix) · next-themes · vitest (logic tests) · Playwright MCP for visual verification.

## Context

The spec is `webapp_design/webapp-export/WEBAPP_PROMPT.md` plus the ten mockups. Screen → route map:

| Shot | Route(s) | Desktop change |
|------|----------|----------------|
| 01-d | `/login`, `/login/verify` | split-screen: primary brand panel left, form right; disabled Google button |
| 02-d | `/onboarding/path` | wider container, band chips `lg:grid-cols-6` |
| 03-d | `/onboarding/placement` | 2-col: audio/passage left (sticky), questions right |
| 04-d | `/onboarding/placement/result` | split-screen: band hero left, skill detail right |
| 05-d | `/learn/[phase]/[lesson]` | ~680px reading column + "TRONG BÀI" TOC rail with scrollspy |
| 06-d | `…/exercise` | focus mode (no sidebar/tabs at lg), centered prompt, wrong-state = answers left / keyNote+AI right |
| 07-d | `…/vocab/{flashcards,quiz,match}` | focus mode at lg, larger flashcard, destructive-tint "Chưa thuộc" |
| 08-d | `/listening/[slug]` | 2-col: player+questions left, "LỜI THOẠI" transcript rail right (gating kept) |
| 09-d | `/ielts` | **UX change (user-approved):** skill tabs on the hub, 8-col grid, "xem tất cả" expander, tiles deep-link `?skill=` into the detail tabs |
| 10-d | `/settings` | wider container, `text-h1` heading |

Decisions already made with the user:
- **Google button (01-d): render it, disabled** with a "sắp ra mắt" hint — no OAuth backend exists and logic must not change.
- **IELTS hub (09-d): adopt the mockup's UX**, not just its look — tabs select a skill client-side and tiles open the test with that skill's tab pre-selected. Per-test band badges (green "8.0" tiles in the mockup) need attempt data the app doesn't record — render tile states only from real data (`isComplete`); note this deviation in the commit message.
- Design deviations accepted: sidebar keeps lucide icons (mockup's emoji icons); LessonTabs keeps its text back-link (mockup's circle-arrow is an equivalent affordance); dashboard already matches (commit `6423e3b`) and is out of scope.

## Global Constraints

Copied from `WEBAPP_PROMPT.md` — every task implicitly includes these:

- **UI/layout only. KHÔNG động vào logic hay data-fetching** — server queries, reducers, handlers, API routes stay byte-identical (exception: Task 10's `searchParams` read, a user-approved UX change). `npm test` in `web/` is the guard.
- **Desktop pass (≥1024px) only** — `<1024px` must keep today's mobile rendering: every change is behind `lg:` unless a screen has no mobile difference (new brand panels are `hidden lg:flex`).
- Sidebar shell on every logged-in screen: **~220–236px wide**, logo top, vertical nav (Lộ trình · Luyện nghe · Đề IELTS · Từ vựng · Cài đặt), active item `bg-primary/10` + primary text.
- Auth & onboarding screens have **no sidebar** — centered; login & result use **split-screen** (left = primary panel, right = form/detail).
- Reading content capped at a readable width (**~680px**); optional right columns: TOC (lecture), transcript (listening).
- Exercise runner = **focus mode, no sidebar**: question centered; wrong state → answers left, keyNote + AI explanation right.
- Use the horizontal space: IELTS grid 8 cols, onboarding band chips 6 cols, vocab games side-by-side cards.
- **Use only existing tokens** (`globals.css` oklch vars, `text-h1/h2/display/caption`, glow/flip/motion utilities), Be Vietnam Pro, Button variants `accent`/`success`, `lesson-node`. **No new colors. Match the mockups' colors/spacing/radii exactly — don't invent.**
- UI copy 100% Vietnamese; English only inside lesson content.
- Work screens in mockup order (01→10). Repo rule: work directly on `main`; commit after every task.

**Testing approach:** logic tests exist (`npm test` = vitest; suites: runner reducer, vocab games, grading, progress, band, otp, vocab, attempts) but there is no component/DOM harness — do NOT add one (YAGNI). Each task is verified by (1) `npx tsc --noEmit`, (2) `npm test` (proves logic untouched), (3) Playwright MCP screenshot at **1280×800** against the mapped `NN-d.png`, plus a spot-check at 375px that mobile is unchanged. The one real code path added (TOC extraction, Task 6) gets TDD with a vitest suite.

Dev server: `cd web && npm run dev` (assume `http://localhost:3000`; log in via the dev OTP flow if a session is needed).

---

### Task 0: Baseline

**Files:** none modified.

- [ ] **Step 1: Commit this plan** (it already lives at `docs/superpowers/plans/2026-07-07-desktop-pass.md`)

```bash
cd /home/ncd/learnspaces/learning_english
git add docs/superpowers/plans/2026-07-07-desktop-pass.md
git commit -m "docs: desktop-pass implementation plan"
```

- [ ] **Step 2: Confirm clean tree and green baseline**

```bash
git status --short -- web/    # expect: empty
cd web && npx tsc --noEmit && npm test
```
Expected: no output from status; tsc clean; all vitest suites pass.

---

### Task 1: Sidebar width + active-state per spec

The shell exists (`AppSidebar` w-64 = 256px, active = `bg-secondary`). Spec: ~220–236px and active `bg-primary/10` + primary text.

**Files:**
- Modify: `web/src/components/AppSidebar.tsx` (lines 38, 55–56)
- Modify: `web/src/app/(app)/layout.tsx` (line 21)

**Interfaces:**
- Produces: shell content offset `lg:pl-[232px]` — later tasks' screenshots assume it.

- [ ] **Step 1: Narrow the sidebar.** In `AppSidebar.tsx` line 38 change `w-64` → `w-[232px]`:

```tsx
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-[232px] flex-col border-r border-border bg-card lg:flex">
```

- [ ] **Step 2: Active nav state.** Lines 55–56, change the active branch of the `cn(...)`:

```tsx
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
```

- [ ] **Step 3: Match the layout offset.** In `(app)/layout.tsx` line 21: `lg:pl-64` → `lg:pl-[232px]`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; Playwright at 1280px on `/dashboard`: sidebar ~232px, active item lavender-tinted with primary text (compare sidebar in `05-d.png`); no content overlap.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AppSidebar.tsx "web/src/app/(app)/layout.tsx"
git commit -m "feat(web): sidebar 232px + bg-primary/10 active state per desktop spec"
```

---

### Task 2: Auth split-screen (01-d)

**Files:**
- Create: `web/src/app/(auth)/layout.tsx`
- Modify: `web/src/app/(auth)/login/page.tsx`
- Modify: `web/src/app/(auth)/login/verify/page.tsx`

**Interfaces:**
- Produces: `(auth)/layout.tsx` wraps both login pages; below `lg` it renders children unchanged (mobile identical). Pages keep their own `max-w-sm` column, which the layout's right half centers.

- [ ] **Step 1: Create `web/src/app/(auth)/layout.tsx`**

```tsx
/**
 * Desktop split-screen shell for the auth pages (mockup 01-d): left half is a
 * primary brand panel (hidden below lg — mobile keeps the single centered
 * column), right half centers whatever page is active. Presentation only.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-center">
        <div aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-28 -left-20 size-80 rounded-full bg-white/10" />
        <div aria-hidden className="absolute top-1/4 right-24 size-20 rounded-full bg-white/10" />
        <div className="relative max-w-md">
          <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold">
            H
          </div>
          <p className="text-display font-extrabold">Học chắc, thi tốt IELTS mỗi ngày.</p>
          <p className="mt-4 text-body text-primary-foreground/80">
            Lộ trình cá nhân hoá theo trình độ, luyện tập có phản hồi tức thì và duy trì streak
            học tập.
          </p>
        </div>
      </div>
      <div className="lg:flex lg:flex-col lg:justify-center">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Login page container + hide its logo tile at lg** (brand now lives in the left panel). In `login/page.tsx` line 41 append `lg:min-h-0` to the container; line 42 add `lg:hidden` to the logo div:

```tsx
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 lg:min-h-0">
      <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-primary-glow lg:hidden">
```

- [ ] **Step 3: Disabled Google button.** In `login/page.tsx`, immediately after the closing `</form>` (line 66), insert:

```tsx
      <div className="mt-6 flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-border" />
        <span className="text-caption text-muted-foreground">hoặc</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="mt-4 w-full" disabled>
        Tiếp tục với Google
      </Button>
      <p className="mt-1.5 text-center text-caption text-muted-foreground">Sắp ra mắt</p>
```

- [ ] **Step 4: Verify page container.** In `login/verify/page.tsx`, append `lg:min-h-0` to its root `mx-auto flex min-h-screen w-full max-w-sm …` container (same edit as Step 2; leave everything else, including the OTP boxes, untouched).

- [ ] **Step 5: Verify** — `npx tsc --noEmit`; Playwright 1280px `/login` vs `01-d.png`: indigo left panel with headline + decorative circles, form right with disabled Google button; `/login/verify` gets the same shell; 375px unchanged from today.

- [ ] **Step 6: Commit**

```bash
git add "web/src/app/(auth)/layout.tsx" "web/src/app/(auth)/login/page.tsx" "web/src/app/(auth)/login/verify/page.tsx"
git commit -m "feat(web): auth split-screen brand panel + disabled Google button (01-d)"
```

---

### Task 3: Onboarding path — wide layout + 6-col band chips (02-d)

**Files:**
- Modify: `web/src/app/onboarding/path/page.tsx` (line 48 container, title line)
- Modify: `web/src/components/GoalPicker.tsx` (line 68 grid)

**Interfaces:**
- Consumes: `GoalPicker` is shared with `SettingsGoalForm` — the 6-col grid also appears inside settings at `lg`, which is fine (wide row there too).

- [ ] **Step 1: Widen the page.** `path/page.tsx` line 48:

```tsx
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8 lg:max-w-3xl">
```

- [ ] **Step 2: Scale the title.** On the page's `<h1>` (the `text-h1 font-extrabold` heading right below the progress bar), append `lg:text-display` to its className. Do not change the copy.

- [ ] **Step 3: Band chips 6-up.** `GoalPicker.tsx` line 68:

```tsx
        <div role="radiogroup" className="grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-3">
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm test`; Playwright 1280px `/onboarding/path` vs `02-d.png`: one row of six square chips, "6.5" selected style unchanged (primary + glow + "Phổ biến"); CEFR tab rows simply wider; 375px = today's 3-col grid.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/onboarding/path/page.tsx web/src/components/GoalPicker.tsx
git commit -m "feat(web): onboarding path desktop width + 6-col band chips (02-d)"
```

---

### Task 4: Placement wizard — 2-column steps (03-d)

**Files:**
- Modify: `web/src/app/onboarding/placement/page.tsx` (container only)
- Modify: `web/src/components/PlacementWizard.tsx` (Stepper line 46; listening block lines 227–239; reading blocks lines 256–275; writing wrapper line 285)

**Interfaces:**
- Consumes: `AudioPlayer` (compact variant), `QuestionBatch`, `MarkdownContent` — all untouched internally; only their wrappers change. All handlers (`handleFinishListening`, `submitSection`, …) stay byte-identical.

- [ ] **Step 1: Widen the page container.** In `placement/page.tsx`, on the root `mx-auto max-w-3xl px-4 py-8` div, append `lg:max-w-5xl`.

- [ ] **Step 2: Center the stepper at lg.** `PlacementWizard.tsx` line 46:

```tsx
    <div className="mb-8 flex items-center lg:mx-auto lg:w-full lg:max-w-xl">
```

- [ ] **Step 3: Listening step 2-col.** Replace the fragment at lines 227–239 (the `{listening ? (<> <AudioPlayer/> <QuestionBatch/> </>) : (fallback)}` block) so player and questions split at lg — audio card left and sticky, questions right:

```tsx
          {listening ? (
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-8">
              <div className="lg:sticky lg:top-8">
                <AudioPlayer src={listening.audioUrl} />
              </div>
              <QuestionBatch
                questions={listening.questions}
                onChange={(id, value) => setListeningAnswers((prev) => ({ ...prev, [id]: value }))}
              />
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Phần nghe hiện chưa sẵn sàng — bạn có thể tiếp tục sang phần Đọc.
            </p>
          )}
```

- [ ] **Step 4: Reading step 2-col.** Wrap the passage card (lines 256–261) and the sections list (lines 262–275) in one grid — passage left, sticky, independently scrollable; questions right:

```tsx
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
              <span className="mb-2 inline-block rounded-md bg-muted px-2 py-0.5 text-caption font-semibold text-muted-foreground">
                ĐOẠN VĂN
              </span>
              <MarkdownContent content={readingMd} />
            </div>
            <div className="flex flex-col gap-6">
              {readingSections.map((section) => (
                /* existing section block from lines 262–275 — keep byte-identical */
              ))}
            </div>
          </div>
```

(Keep the section-mapping JSX byte-identical — only its parent wrapper is new.)

- [ ] **Step 5: Writing step readable width.** On the writing step's root div (line 285 `flex flex-col gap-6`), append `lg:mx-auto lg:w-full lg:max-w-3xl` (no 2-col reference exists for writing; a centered readable column is the spec-conform default).

- [ ] **Step 6: Verify** — `npx tsc --noEmit && npm test`; Playwright 1280px `/onboarding/placement` vs `03-d.png`: stepper centered, audio card left / "Câu 1/6" questions right; advance to reading (passage left sticky) and writing; 375px single-column as today.

- [ ] **Step 7: Commit**

```bash
git add web/src/app/onboarding/placement/page.tsx web/src/components/PlacementWizard.tsx
git commit -m "feat(web): placement wizard 2-col desktop steps (03-d)"
```

---

### Task 5: Placement result — split-screen (04-d)

**Files:**
- Modify: `web/src/app/onboarding/placement/result/page.tsx` (returned JSX only; all queries/derivations lines 1–63 stay identical)

- [ ] **Step 1: Split the page + hero confetti.** Replace the outer wrapper (line 65) and hero (lines 66–74):

```tsx
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative overflow-hidden rounded-b-3xl bg-primary px-6 py-10 text-center text-primary-foreground lg:flex lg:flex-col lg:items-center lg:justify-center lg:rounded-none">
        <span aria-hidden className="absolute top-14 right-1/4 hidden size-3 rotate-12 rounded-[3px] bg-accent lg:block" />
        <span aria-hidden className="absolute top-1/3 left-16 hidden size-3 -rotate-12 rounded-[3px] bg-streak lg:block" />
        <span aria-hidden className="absolute bottom-24 right-20 hidden size-2.5 rotate-45 rounded-[2px] bg-white/40 lg:block" />
        <p className="text-sm font-medium text-primary-foreground/80">Trình độ hiện tại của bạn</p>
        <p className="mt-2 text-[64px] font-extrabold leading-none lg:text-[96px]">{attempt.band.toFixed(1)}</p>
        {phase ? (
          <span className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-caption">
            Tương đương CEFR {phase.cefrLabel}
          </span>
        ) : null}
      </div>
```

- [ ] **Step 2: Right column centers vertically.** On the detail wrapper (line 76), append `lg:justify-center lg:px-10 lg:py-8`:

```tsx
      <div className="mx-auto flex max-w-lg flex-col items-center gap-8 px-4 py-12 text-center lg:justify-center lg:px-10 lg:py-8">
```

- [ ] **Step 3: Compact suggestion card per mockup.** Replace the recommendation card (lines 131–144) with the mockup's two-line "Điểm bắt đầu được gợi ý" form, keeping the same data:

```tsx
        <div className="w-full rounded-xl border border-primary/25 bg-primary/5 p-5 text-left">
          <p className="text-caption text-muted-foreground">Điểm bắt đầu được gợi ý</p>
          <p className="mt-1 font-bold text-primary">
            {phase?.title ?? "Bài học đầu tiên"}
            {startLesson ? <> → {startLesson.title}</> : null}
          </p>
          <p className="mt-2 text-caption text-muted-foreground">
            Các bài học trước đó sẽ được đánh dấu là đã bỏ qua — bạn vẫn có thể quay lại xem bất
            cứ lúc nào.
          </p>
        </div>
```

- [ ] **Step 4: CTA copy per mockup.** Line 148: change the Link text `Bắt đầu lộ trình` → `Bắt đầu học ngay 🚀` and append `lg:w-auto lg:min-w-64` to its className. Keep `href={ctaHref}` and `ResetToStartButton` as they are.

- [ ] **Step 5: Verify** — `npx tsc --noEmit && npm test`; Playwright 1280px `/onboarding/placement/result` vs `04-d.png` (needs a completed attempt — reuse the placement run from Task 4's verify): full-height indigo left with 96px band + confetti squares, skills/suggestion/CTA right; weakest-skill bar still `bg-destructive` (Viết dashed "chờ chấm" row unchanged); 375px = today's stacked layout.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/onboarding/placement/result/page.tsx
git commit -m "feat(web): placement result split-screen hero (04-d)"
```

---

### Task 6: Lecture reader — 680px column + TOC rail with scrollspy (05-d)

The one task with a real new code path (markdown → TOC extraction) — TDD it.

**Files:**
- Create: `web/src/lib/toc.ts`
- Create (test): `web/src/lib/toc.test.ts`
- Create: `web/src/components/LectureToc.tsx`
- Modify: `web/src/components/MarkdownContent.tsx` (h2 renderer, lines 9–13)
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx` (lines 33–44)

**Interfaces:**
- Produces: `slugifyHeading(text: string): string` and `extractToc(md: string): TocEntry[]` where `TocEntry = { id: string; text: string }` (H2s only, fenced code skipped); `LectureToc({ entries: TocEntry[] })` client component (hidden below lg). `MarkdownContent` stamps `id={slugifyHeading(...)}` on every `<h2>` so TOC anchors resolve. Known limitation (acceptable): duplicate H2 titles collide on one id.

- [ ] **Step 1: Write the failing test** — `web/src/lib/toc.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { extractToc, slugifyHeading } from "./toc";

describe("slugifyHeading", () => {
  it("lowercases, hyphenates, strips Vietnamese diacriticals incl. đ", () => {
    expect(slugifyHeading("Cấu trúc")).toBe("cau-truc");
    expect(slugifyHeading("Dấu hiệu nhận biết")).toBe("dau-hieu-nhan-biet");
    expect(slugifyHeading("So sánh với quá khứ đơn")).toBe("so-sanh-voi-qua-khu-don");
  });

  it("drops punctuation and collapses whitespace", () => {
    expect(slugifyHeading("Have/Has + V3 (past participle)!")).toBe("havehas-v3-past-participle");
  });
});

describe("extractToc", () => {
  it("collects H2s only, in order", () => {
    const md = "# Title\n\n## Cấu trúc\ntext\n### sub\n\n## Cách dùng\n";
    expect(extractToc(md)).toEqual([
      { id: "cau-truc", text: "Cấu trúc" },
      { id: "cach-dung", text: "Cách dùng" },
    ]);
  });

  it("ignores ## lines inside fenced code blocks and strips inline markers", () => {
    const md = "```\n## not a heading\n```\n## **Dấu hiệu** `nhận biết`\n";
    expect(extractToc(md)).toEqual([{ id: "dau-hieu-nhan-biet", text: "Dấu hiệu nhận biết" }]);
  });

  it("returns [] when there are no H2s", () => {
    expect(extractToc("# only h1\nbody")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — must fail** — `cd web && npx vitest run src/lib/toc.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `web/src/lib/toc.ts`**

```ts
export interface TocEntry {
  id: string;
  text: string;
}

/**
 * URL-safe anchor slug for a heading (Vietnamese diacritics stripped, đ→d).
 * Shared by MarkdownContent (id= on each <h2>) and the lecture TOC so anchors
 * always agree. Duplicate headings collide on one id — acceptable for lecture
 * content, which doesn't repeat section titles.
 */
export function slugifyHeading(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Extracts `## ` (H2) headings from markdown, skipping fenced code blocks
 * and stripping inline `*_\`` markers, in document order. */
export function extractToc(md: string): TocEntry[] {
  const entries: TocEntry[] = [];
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      const text = m[1].replace(/[*_`]/g, "").trim();
      entries.push({ id: slugifyHeading(text), text });
    }
  }
  return entries;
}
```

- [ ] **Step 4: Run the test — must pass** — `npx vitest run src/lib/toc.test.ts` → PASS. Commit the pair:

```bash
git add web/src/lib/toc.ts web/src/lib/toc.test.ts
git commit -m "feat(web): markdown H2 TOC extraction with Vietnamese-safe slugs"
```

- [ ] **Step 5: Stamp ids on rendered H2s.** In `MarkdownContent.tsx`, import the slug helper and replace the `h2` renderer (lines 9–13). react-markdown may pass nested elements as children, so flatten to text first — add this helper above `components`:

```tsx
import { slugifyHeading } from "@/lib/toc";

/** Flattens react-markdown heading children (strings, <strong>, <code>, …)
 * to plain text so the anchor id matches `extractToc`'s. */
function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return childrenToText((children as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}
```

```tsx
  h2: ({ children }) => (
    <h2
      id={slugifyHeading(childrenToText(children))}
      className="mt-10 mb-3 scroll-mt-8 border-b border-border pb-2 text-xl font-bold tracking-tight"
    >
      {children}
    </h2>
  ),
```

(Note the added `scroll-mt-8` so anchored headings don't hide under the viewport edge.)

- [ ] **Step 6: Create `web/src/components/LectureToc.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { TocEntry } from "@/lib/toc";

/**
 * "TRONG BÀI" table-of-contents rail for the lecture page (mockup 05-d).
 * Desktop-only (hidden below lg). Scrollspy via IntersectionObserver: the
 * topmost visible H2 gets the primary left-bar highlight.
 */
export function LectureToc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed.filter((o) => o.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "0% 0% -70% 0%" },
    );
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="Trong bài" className="sticky top-8 hidden self-start lg:block">
      <p className="mb-3 text-caption font-bold tracking-wide text-muted-foreground">TRONG BÀI</p>
      <ul className="flex flex-col gap-1 border-l border-border">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={cn(
                "-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors",
                activeId === entry.id
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 7: Lecture page grid.** In `learn/[phase]/[lesson]/page.tsx`, add imports and replace the return (lines 33–44):

```tsx
import { extractToc } from "@/lib/toc";
import { LectureToc } from "@/components/LectureToc";
```

```tsx
  const toc = extractToc(lesson.lectureMd);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,680px)_220px] lg:justify-center lg:gap-10">
      <div>
        <LessonTabs
          phaseTitle={lesson.phase.title}
          lessonTitle={lesson.title}
          basePath={base}
          active="lecture"
        />

        <MarkdownContent content={lesson.lectureMd} />
      </div>

      <LectureToc entries={toc} />
    </div>
  );
```

- [ ] **Step 8: Verify** — `npx tsc --noEmit && npm test`; Playwright 1280px on an unlocked lesson vs `05-d.png`: sidebar + ~680px reading column + right rail listing the lecture's H2s; clicking a TOC entry scrolls to the heading; scrolling moves the primary highlight; 375px shows no rail.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/MarkdownContent.tsx web/src/components/LectureToc.tsx "web/src/app/(app)/learn/[phase]/[lesson]/page.tsx"
git commit -m "feat(web): lecture desktop reading column + TRONG BAI scrollspy rail (05-d)"
```

---

### Task 7: Exercise runner — desktop focus mode with split feedback (06-d)

The route sits inside the `(app)` shell, so "no sidebar" at lg is done presentationally: the page's wrapper becomes a fixed full-viewport overlay (`z-50` covers the `z-10` sidebar). Mobile keeps today's in-flow layout, tabs included.

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx` (wrapper JSX only)
- Modify: `web/src/components/ExerciseRunner.tsx` (`ExerciseRunnerSession` return, lines 128–251)
- Modify: `web/src/components/runner/QuestionCard.tsx` (prompt classNames only)

**Interfaces:**
- Consumes: `runnerReducer`/`initRunnerState`, `QuestionCard`, `ExplanationSlot` — all internals untouched (`reducer.test.ts` guards). `ExplanationSlot` still renders null today; it keeps its slot in the right column for when AI explanations ship.

- [ ] **Step 1: Overlay wrapper in `exercise/page.tsx`.** Keep all data loading; restructure only the returned wrapper (current shape: `<div className="mx-auto max-w-3xl px-4 py-8">` containing `<LessonTabs …/>` then `<ExerciseRunner …/>`):

```tsx
    <div className="mx-auto max-w-3xl px-4 py-8 lg:fixed lg:inset-0 lg:z-50 lg:m-0 lg:max-w-none lg:overflow-y-auto lg:bg-background lg:px-0 lg:py-0">
      <div className="lg:hidden">
        <LessonTabs
          {/* existing props unchanged */}
          active="exercise"
        />
      </div>
      <div className="lg:mx-auto lg:max-w-5xl lg:px-8 lg:py-10">
        <ExerciseRunner {/* existing props unchanged */} />
      </div>
    </div>
```

- [ ] **Step 2: Center kicker + prompt at lg.** In `ExerciseRunner.tsx` line 190 append `lg:text-center`:

```tsx
      <p className="text-caption font-semibold text-primary lg:text-center">{kickerFor(question.kind)}</p>
```

In `runner/QuestionCard.tsx`, find the element that renders the question prompt — for MULTIPLE_CHOICE the `<p>` printing `question.prompt`, and for FILL_BLANK the container that renders the `splitOnBlanks` segments with inline inputs — and append `lg:mb-6 lg:text-center lg:text-h2 lg:font-bold` to each's className (mockup 06-d: "She ______ in London since 2020." large and centered). Change classNames only — no structure, state, or handler changes in this file.

- [ ] **Step 3: Split answers/feedback at lg.** In `ExerciseRunner.tsx`, restructure lines 192–249: the state-tinted card keeps `QuestionCard` and the correct-state block; the incorrect-state feedback moves out into a right column; the action buttons move below the grid (one instance, both breakpoints):

```tsx
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div
          className={cn(
            "rounded-xl border p-5 transition-colors",
            isIncorrect && "border-destructive/50 bg-destructive/5",
            isCorrect && "border-success/50 bg-success-bg",
            !isIncorrect && !isCorrect && "border-border bg-card",
          )}
        >
          <QuestionCard
            key={question.id}
            question={question}
            disabled={isChecking || isCorrect}
            status={state.phase}
            onChangeInput={(value) => dispatch({ type: "SET_INPUT", value })}
          />

          {isCorrect && (
            <div className="mt-3 text-sm">
              <p className="font-medium text-success">Chính xác!</p>
              {state.result?.correctAnswer && (
                <p className="text-muted-foreground">
                  Đáp án: <span className="font-medium text-foreground">{state.result.correctAnswer}</span>
                </p>
              )}
              {state.result?.keyNote && <p className="text-muted-foreground">{state.result.keyNote}</p>}
            </div>
          )}
        </div>

        {isIncorrect && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-destructive">Chưa đúng, thử lại.</p>
            {state.result?.keyNote && (
              <div className="rounded-xl border border-destructive/30 bg-destructive-bg p-4">
                <p className="mb-1 text-caption font-bold text-destructive">💡 Ghi nhớ</p>
                <p className="text-sm leading-relaxed">{state.result.keyNote}</p>
              </div>
            )}
            <ExplanationSlot explanation={state.result?.explanation ?? null} />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        {isCorrect ? (
          <Button className="w-full sm:w-auto" onClick={() => dispatch({ type: "CONTINUE" })}>
            Tiếp tục
          </Button>
        ) : (
          <Button
            className="w-full sm:w-auto"
            variant={isIncorrect ? "outline" : "default"}
            onClick={handleSubmit}
            disabled={isChecking || state.input.trim() === ""}
          >
            {isIncorrect ? "Thử lại" : "Kiểm tra"}
          </Button>
        )}
      </div>
```

(All `dispatch`/`handleSubmit` wiring is copied verbatim — layout moved, logic identical. The mockup's "Câu tiếp →" primary CTA maps to the existing "Kiểm tra"/"Tiếp tục" flow; keep existing labels.)

- [ ] **Step 4: Center the finished screen at lg.** On the finished-state wrapper (line 130) append `lg:mx-auto lg:max-w-xl`.

- [ ] **Step 5: Verify** — `npm test` (reducer suite green = logic untouched); Playwright 1280px on an exercise vs `06-d.png`: no sidebar visible, ✕ + progress top, centered prompt; answer wrong → options left with shake, Ghi nhớ card right; answer right → pop + Tiếp tục; finish → centered completion card. 375px: stacked as today (tabs visible, feedback below options).

- [ ] **Step 6: Commit**

```bash
git add "web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx" web/src/components/ExerciseRunner.tsx web/src/components/runner/QuestionCard.tsx
git commit -m "feat(web): exercise runner desktop focus mode + split feedback column (06-d)"
```

---

### Task 8: Vocab games — focus mode + desktop sizing (07-d)

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/flashcards/page.tsx`, `…/quiz/page.tsx`, `…/match/page.tsx` (wrapper className only, all three)
- Modify: `web/src/components/vocab/Flashcards.tsx` (card height line 133, report buttons lines 154–158)

**Interfaces:**
- Consumes: `vocab/games.ts` round builders — read-only (`games.test.ts` guards). Button `variant="destructive"` already renders the pale-red tint (`bg-destructive/10 text-destructive`) the mockup shows for "Chưa thuộc".

- [ ] **Step 1: Focus overlay on all three game pages.** In each page (current root: `<div className="mx-auto max-w-2xl px-4 py-8">`, e.g. `flashcards/page.tsx` line 41), split wrapper vs. inner width so the overlay spans the viewport but content stays centered:

```tsx
    <div className="lg:fixed lg:inset-0 lg:z-50 lg:overflow-y-auto lg:bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:py-10">
        {/* existing page children unchanged */}
      </div>
    </div>
```

Apply identically in `flashcards/page.tsx`, `quiz/page.tsx`, `match/page.tsx` (keep each page's existing inner `max-w-2xl` value if it differs — only add the outer overlay div and move the width classes onto the inner one).

- [ ] **Step 2: Bigger flashcard at lg.** `Flashcards.tsx` line 133: `h-64` → `h-64 lg:h-80`.

- [ ] **Step 3: "Chưa thuộc" destructive tint.** Line 154: `variant="outline"` → `variant="destructive"` (label stays "Chưa thuộc"; the disabled-until-flipped logic stays). Line 157's success "Đã thuộc" button is already per mockup — leave it.

- [ ] **Step 4: Verify** — `npm test` (games suite green); Playwright 1280px on each mode vs `07-d.png`: no sidebar; flashcard taller with pale-red/green button pair; quiz options 2×2 with 🔥 streak chip; match tiles + timer as today but overlaid; 375px unchanged apart from the flashcard staying h-64.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(app)/learn/[phase]/[lesson]/vocab/flashcards/page.tsx" "web/src/app/(app)/learn/[phase]/[lesson]/vocab/quiz/page.tsx" "web/src/app/(app)/learn/[phase]/[lesson]/vocab/match/page.tsx" web/src/components/vocab/Flashcards.tsx
git commit -m "feat(web): vocab games desktop focus mode + flashcard sizing (07-d)"
```

---

### Task 9: Listening detail — transcript rail (08-d)

**Files:**
- Modify: `web/src/app/(app)/listening/[slug]/page.tsx` (container only)
- Modify: `web/src/components/ListeningSetView.tsx` (layout + `TranscriptBody` speaker colors)

**Interfaces:**
- Consumes: `AudioPlayer` (full), `ListeningRunner`, the `completed` gating state — gating logic unchanged: the desktop rail shows a lock message until `onFinished` fires, exactly mirroring the mobile accordion's rule.

- [ ] **Step 1: Widen the page.** In `listening/[slug]/page.tsx`, append `lg:max-w-5xl` to the root `mx-auto max-w-3xl px-4 py-8` container.

- [ ] **Step 2: Speaker colors in `TranscriptBody`.** Replace the component (lines 13–29) — speakers are colored by order of first appearance (mockup: Interviewer primary, Applicant coral):

```tsx
const SPEAKER_PALETTE = ["text-primary", "text-accent"];

function TranscriptBody({ transcriptMd }: { transcriptMd: string }) {
  const lines = transcriptMd.split("\n").filter((l) => l.trim().length > 0);
  const speakerColor = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(TRANSCRIPT_LINE_RE);
    if (m && !speakerColor.has(m[1])) {
      speakerColor.set(m[1], SPEAKER_PALETTE[speakerColor.size % SPEAKER_PALETTE.length]);
    }
  }
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const m = line.match(TRANSCRIPT_LINE_RE);
        if (!m) return <p key={i}>{line}</p>;
        return (
          <p key={i}>
            <span className={cn("font-semibold", speakerColor.get(m[1]) ?? "text-foreground")}>
              {m[1]}:
            </span>{" "}
            <span className="text-muted-foreground">{m[2]}</span>
          </p>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 2-col layout with a sticky rail.** In `ListeningSetView`'s return, change the root (line 54) to a grid, keep player + runner + the existing mobile `<details>` accordion in the left column (add `lg:hidden` to the `<details>` line 59), and add the desktop rail as a sibling:

```tsx
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <AudioPlayer src={audioUrl} variant="full" />

        <ListeningRunner slug={slug} questions={questions} onFinished={() => setCompleted(true)} />

        <details className="rounded-xl border border-border bg-card lg:hidden" open={completed && transcriptOpen}>
          {/* existing summary + body from lines 60–88 — keep byte-identical */}
        </details>
      </div>

      <aside className="sticky top-8 hidden max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 lg:block">
        <p className="mb-3 text-caption font-bold tracking-wide text-muted-foreground">📄 LỜI THOẠI</p>
        {completed ? (
          <TranscriptBody transcriptMd={transcriptMd} />
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            Hoàn thành câu hỏi để mở khóa transcript.
          </p>
        )}
      </aside>
    </div>
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm test`; Playwright 1280px on a listening set vs `08-d.png`: player + questions left, LỜI THOẠI rail right (locked note first; finish the questions → transcript appears with alternating primary/coral speaker names); 375px: rail absent, accordion behaves as today.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(app)/listening/[slug]/page.tsx" web/src/components/ListeningSetView.tsx
git commit -m "feat(web): listening desktop transcript rail + speaker colors (08-d)"
```

---

### Task 10: IELTS hub — skill tabs, 8-col grid, xem-tất-cả, skill deep-link (09-d)

**User-approved UX change.** The hub gains client-side skill tabs; tiles deep-link to `/ielts/[n]?skill=…` which pre-selects the detail page's tab. No new data: per-test band badges from the mockup are impossible without attempt tracking — tiles keep the real `isComplete` state.

**Files:**
- Create: `web/src/components/IeltsHub.tsx`
- Modify: `web/src/app/(app)/ielts/page.tsx` (lines 20–55: keep query + EmptyState, delegate the rest)
- Modify: `web/src/app/(app)/ielts/[n]/page.tsx` (accept `searchParams`, line 47 `defaultValue`)

**Interfaces:**
- Consumes: hub page's existing `db.ieltsTest.findMany({ select: { number, isComplete } })` result.
- Produces: `IeltsHub({ tests }: { tests: { number: number; isComplete: boolean }[] })`; detail page accepts `searchParams: Promise<{ skill?: string }>` and treats anything other than `"writing" | "speaking"` as `"reading"`.

- [ ] **Step 1: Create `web/src/components/IeltsHub.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

const SKILLS = [
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
  { key: "speaking", label: "Speaking" },
] as const;

type IeltsSkill = (typeof SKILLS)[number]["key"];

const INITIAL_VISIBLE = 16;

/**
 * IELTS hub body (mockup 09-d): segmented skill tabs + numbered test grid.
 * The selected skill only changes which tab the detail page opens on
 * (`?skill=` deep-link) — tests aren't filtered, since every test contains
 * all three skills. Client component purely for the tab + "xem tất cả" state.
 */
export function IeltsHub({ tests }: { tests: { number: number; isComplete: boolean }[] }) {
  const [skill, setSkill] = useState<IeltsSkill>("reading");
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? tests : tests.slice(0, INITIAL_VISIBLE);
  const hiddenCount = tests.length - visible.length;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h1 font-extrabold">Đề luyện IELTS</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {tests.length} đề luyện thi đầy đủ kỹ năng: Reading, Writing, Speaking và đáp án tham
            khảo.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Kỹ năng"
          className="flex shrink-0 self-start rounded-full bg-muted p-1"
        >
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={skill === s.key}
              onClick={() => setSkill(s.key)}
              className={cn(
                "min-h-9 rounded-full px-4 text-sm font-semibold transition-colors",
                skill === s.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
        {visible.map((test) => (
          <Link
            key={test.number}
            href={`/ielts/${test.number}?skill=${skill}`}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-center transition-colors hover:bg-muted/50",
              !test.isComplete && "opacity-60 hover:opacity-80",
            )}
          >
            <p className="text-h2 font-bold">{String(test.number).padStart(2, "0")}</p>
            {!test.isComplete && (
              <span className="px-1 text-caption font-medium text-muted-foreground">
                Chưa đủ nội dung
              </span>
            )}
          </Link>
        ))}
      </div>

      {hiddenCount > 0 && (
        <p className="mt-4 text-center text-caption text-muted-foreground">
          Còn {hiddenCount} đề ·{" "}
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="font-semibold text-primary hover:underline"
          >
            xem tất cả
          </button>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Slim the hub page.** In `ielts/page.tsx`, keep the auth guard, query, and the `tests.length === 0` → `EmptyState` branch; replace the header (lines 22–25) and grid (lines 34–52) with:

```tsx
import { IeltsHub } from "@/components/IeltsHub";
```

```tsx
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:max-w-6xl">
      {tests.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Chưa có đề luyện thi nào"
          description="Quay lại sau để luyện đề IELTS nhé."
        />
      ) : (
        <IeltsHub tests={tests} />
      )}
    </div>
  );
```

(Drop the now-unused `Link`/`cn` imports from the page.)

- [ ] **Step 3: Detail page honors `?skill=`.** In `ielts/[n]/page.tsx`, extend the signature and the `Tabs` default (line 47):

```tsx
export default async function IeltsTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ skill?: string }>;
}) {
```

```tsx
  const { skill } = await searchParams;
  const defaultSkill = skill === "writing" || skill === "speaking" ? skill : "reading";
```

```tsx
      <Tabs defaultValue={defaultSkill} className="mb-6">
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm test`; Playwright 1280px `/ielts` vs `09-d.png`: title left, Reading/Writing/Speaking segmented control right, 8-col grid of "01"…"16", "Còn 14 đề · xem tất cả" expands to 30; select Writing then click a tile → detail opens on the Writing tab; `/ielts/5` with no param still opens Reading; 375px still 4-col.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/IeltsHub.tsx "web/src/app/(app)/ielts/page.tsx" "web/src/app/(app)/ielts/[n]/page.tsx"
git commit -m "feat(web): IELTS hub skill tabs + 8-col grid + skill deep-link (09-d UX)"
```

---

### Task 11: Settings — desktop width + heading scale (10-d)

The settings screen already matches 10-d structurally (primary profile hero, action rows, dark-mode switch). Mockup's 🔥12 streak chip in the hero is skipped — the app has no real streak data (dashboard hardcodes "🔥 0 ngày"); don't fake it.

**Files:**
- Modify: `web/src/app/(app)/settings/page.tsx` (lines 30–31)

- [ ] **Step 1: Widen + rescale.** Line 30 append `lg:max-w-3xl`; line 31 swap the ad-hoc size for the token scale:

```tsx
    <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-3xl">
      <h1 className="mb-1 text-h1 font-extrabold">Cài đặt</h1>
```

(If the `<h1>` currently has other classes like `mb-1`, keep them — only `text-2xl font-bold` → `text-h1 font-extrabold`.)

- [ ] **Step 2: Verify** — Playwright 1280px `/settings` vs `10-d.png` in **both themes** (flip the Giao diện tối switch): hero + rows span the wider column, toggle still works.

- [ ] **Step 3: Commit**

```bash
git add "web/src/app/(app)/settings/page.tsx"
git commit -m "feat(web): settings desktop width + h1 token scale (10-d)"
```

---

### Task 12: Skeletons for changed shapes + full desktop QA

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/loading.tsx`, `…/exercise/loading.tsx`, `web/src/app/(app)/listening/[slug]/loading.tsx` (or the listening group's `loading.tsx` — match whichever exists), `web/src/app/(app)/ielts/loading.tsx`

- [ ] **Step 1: Mirror the new lg shapes in skeletons.** Minimal edits so loading states don't visibly "jump" at lg:
  - lecture `loading.tsx`: on its root container append `lg:max-w-5xl`; if it renders a single column of `Skeleton` bars, wrap them in `lg:grid lg:grid-cols-[minmax(0,680px)_220px] lg:justify-center lg:gap-10` with a second column of three short `<Skeleton className="h-4 w-32" />` bars for the TOC rail.
  - exercise `loading.tsx`: append `lg:max-w-5xl` to its container (focus overlay isn't worth skeleton-ing).
  - listening detail `loading.tsx`: append `lg:max-w-5xl`.
  - ielts `loading.tsx`: append `lg:max-w-6xl` to the container and `lg:grid-cols-8` to its tile grid.
  Follow each file's existing skeleton idiom — bars only, no new components.

- [ ] **Step 2: Full gate**

```bash
cd web && npx tsc --noEmit && npm test && npm run lint && npm run build
```
Expected: all clean/green.

- [ ] **Step 3: Visual sweep.** With the dev server running, Playwright-screenshot at **1280×800** each of: `/login`, `/login/verify`, `/onboarding/path`, `/onboarding/placement`, `/onboarding/placement/result`, `/dashboard`, a lecture, its exercise (idle + wrong state), `/vocab` + the three game modes, a listening set, `/ielts`, one `/ielts/[n]`, `/settings` — compare each against its `NN-d.png`; repeat the sweep once in dark mode (toggle in settings). Then one pass at 375×800 over the same routes confirming mobile is pixel-equivalent to pre-pass (spot-check against the pre-task-1 commit if unsure).

- [ ] **Step 4: Commit**

```bash
git add -A web/src/app
git commit -m "feat(web): desktop skeleton shapes + QA pass for 01-d..10-d"
```

---

## Verification (end-to-end definition of done)

1. `cd web && npx tsc --noEmit && npm test && npm run lint && npm run build` — all green (proves logic untouched; the only behavioral additions are the TOC lib with its own suite and the approved `?skill=` deep-link).
2. Every route at 1280px matches its `webapp_design/webapp-export/screens-desktop/NN-d.png` in layout, spacing, and color, in light **and** dark themes.
3. Every route at 375px renders as it did before this pass (mobile untouched).
4. Interactive flows still work end-to-end in the browser: OTP login → onboarding path → placement (all 3 steps) → result → dashboard → lecture (TOC scrollspy) → exercise (wrong→split feedback, correct→pop, finish) → vocab games (all 3) → listening (finish → transcript rail unlocks) → IELTS (tab + deep-link) → settings (theme toggle).

## Known deviations from the mockups (intentional)

- Login's Google button is disabled ("Sắp ra mắt") — no OAuth backend (user-approved).
- IELTS tiles show no band badges / "dở dang" dot — no attempt data exists; states reflect real `isComplete` only (user-approved UX otherwise adopted).
- Settings hero shows band, not the 🔥12 streak — streak isn't tracked yet.
- Sidebar uses lucide icons, not the mockup's emoji; LessonTabs keeps its text back-link.
