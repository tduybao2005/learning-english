# "Học tiếng Anh" Design System Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **This repo's standing rule:** never run subagents in parallel — at most one at a time.
> **Final home of this plan:** `docs/superpowers/plans/2026-07-06-design-system-restyle.md` (copy there as the first act of execution).

**Goal:** Apply the "Học tiếng Anh" visual identity (indigo-violet primary + warm-coral accent, Be Vietnam Pro, gamified-but-calm) to every screen of the Next.js app in `web/`, starting from HEAD's default black-and-white shadcn theme — UI/layout only, zero changes to data-fetching or business logic.

**Architecture:** Token-first restyle. Replace shadcn CSS variables in `globals.css` (light + dark), register semantic tokens (`success`, `streak`, `destructive-bg`, …) in Tailwind v4's `@theme inline`, add motion utilities, then build 4 shared primitives (Button variants, `LessonNode`, `LessonTabs`, `AppSidebar` shell) and restyle screens one at a time against the reference mockups. Dark mode via `next-themes` class strategy with a settings toggle.

**Tech Stack:** Next.js 15.5 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (`@theme inline`, `@utility`) · shadcn/ui on `@base-ui/react` (NOT Radix) · `next/font/google` · `next-themes` (to add) · vitest (existing logic tests) · Playwright MCP for visual verification.

## Context

The repo's web app (built per `docs/superpowers/plans/2026-07-02-english-learning-web-app.md`) works functionally but shipped with the default shadcn black-and-white theme. A complete design system was produced externally and lives in `abc/code-export/`:

- `CLAUDE_CODE_PROMPT.md` — the spec (tokens, typography, conventions, component list, screen list). **Read it before starting.**
- `design-reference/Học tiếng Anh - Design System.dc.html` — the design doc (open in a browser to inspect details).
- `screens/01-shot.png … 17-shot.png` — rendered sections of that doc; the per-screen source of truth. Mapping in the table below.

This plan applies that design system end to end. The intended outcome: every route looks like its reference mockup in both light and dark themes, all existing vitest suites still pass (proof logic didn't change), and `tsc`/`next build` are clean.

**Screenshot → route mapping** (design-doc section numbers as rendered in `abc/code-export/screens/`):

| Shot | Design section | Route(s) / topic |
|------|----------------|------------------|
| 01 | Cover | brand tone: "khích lệ mà đáng tin" |
| 02 | 01 · Màu sắc | palette ramps (primary 600 = `oklch(.55 .19 274)`, accent 600 = `oklch(.68 .18 29)`) |
| 03 | 02 · Chữ | Be Vietnam Pro, display 44/800 · h1 30/700 · h2 22/700 · body 16/400 · caption 13/500 |
| 04 | 05 · Thành phần | Button variants, Input/OTP, Badge & Chip |
| 05 | §01 Đăng nhập | `/login`, `/login/verify` |
| 06 | §02 Chọn lộ trình | `/onboarding/path` (band-chip grid vs CEFR cards, tab switch) |
| 07 | §03 Kiểm tra đầu vào | `/onboarding/placement` (3-step stepper Nghe→Đọc→Viết, audio card) |
| 08 | §04 Kết quả đầu vào | `/onboarding/placement/result` (band hero on primary, skill bars) |
| 09 | §05 Trang chủ / Lộ trình | `/dashboard` (phase timeline, lesson-node pills, design notes panel) |
| 10 | §06 Bài giảng | `/learn/[phase]/[lesson]` (3-tab bar, markdown reader) |
| 11 | §07 Bài tập (runner) | `…/exercise` (MCQ states, wrong + "💡 Ghi nhớ" keyNote) |
| 12 | §08 Từ vựng (game) | `…/vocab` + flashcards/quiz/match (progress pill, mode cards, flip) |
| 13 | §09 Luyện nghe | `/listening`, `/listening/[slug]` (primary player card, ±10s, speed chips) |
| 14 | §10 Đề IELTS | `/ielts`, `/ielts/[n]` (grid of 30, skill tabs, amber answer-key warning) |
| 15 | §11 Cài đặt | `/settings` (profile hero, action rows, **Giao diện tối** toggle) + dark-mode preview |
| 16 | §12 Trạng thái dùng chung | empty state (🌱 + CTA), skeleton loading |
| 17 | §13 Web app desktop | ≥1024px fixed sidebar shell + 2-column dashboard |

## Global Constraints

Copied from `abc/code-export/CLAUDE_CODE_PROMPT.md` — every task implicitly includes these:

- **UI/layout only. KHÔNG động vào data-fetching hay business logic** — server queries, reducers, handlers, API routes stay byte-identical where possible. The existing vitest suites (`npm test` in `web/`) are the guard.
- Keep shadcn variable names (`--primary`, `--card`, …) so primitives inherit automatically.
- UI copy: 100% Vietnamese. English appears only inside lesson content.
- No generic green as a brand color — green is reserved for `success` semantics only.
- Base radius 10px (`--radius: 0.625rem`); spacing on a 4px scale.
- Motion: 120/200/320 ms, easing `cubic-bezier(.2,.8,.2,1)`; flip = rotateY 320 ms; correct = 1.14× pop; wrong = shake; progress fill; streak = flame loop; honor `prefers-reduced-motion`.
- A11y: hit targets ≥ 44px for primary touch actions, 4px-ish focus ring in primary, WCAG AA contrast in BOTH themes.
- Mobile-first; **≥1024px**: fixed sidebar shell + 2-column dashboard.
- Elevation: `shadow-sm` at rest, `shadow-md` on hover, CTAs get a primary glow `0 8px 20px primary/28%`.
- Repo rule: work directly on `main`; commit after every task.

**Testing approach note:** logic tests exist (`web/src/**/**.test.ts`, run via `npm test`) but there is no component/RTL harness — do NOT add one (YAGNI). Styling tasks are verified by: (1) `npx tsc --noEmit`, (2) `npm test` (proves logic untouched), (3) visual check of the running app against the mapped reference shot via Playwright MCP screenshots. Where a task adds a real code path (theme toggle, `LessonNode` state mapping) the "failing first" step is the visible/compile-level absence of the feature.

---

### Task 0: Clean baseline

The working tree currently mixes two things: an unrelated session-cookie fix and a previous uncommitted design pass which the user chose to set aside for a from-scratch run. Preserve both before starting.

**Files:**
- Commit: `.env.example`, `docker-compose.yml`, `web/.env.example`, `web/src/lib/auth/session.ts` (cookie fix — keep)
- Stash: everything else modified/untracked under `web/` (previous design pass — recoverable, not deleted)
- Leave: `abc/` untracked (reference material, not app code)

- [ ] **Step 1: Commit the unrelated cookie fix on its own**

```bash
cd /home/ncd/learnspaces/learning_english
git add .env.example docker-compose.yml web/.env.example web/src/lib/auth/session.ts
git commit -m "fix(web): make session-cookie Secure flag configurable for plain-HTTP LAN use"
```

- [ ] **Step 2: Stash the previous design pass (tracked + untracked) so HEAD styling is restored**

```bash
git stash push -u -m "previous uncommitted design pass (pre from-scratch restyle)" -- web/
git status   # expect: only abc/ untracked, no modified files under web/
```

- [ ] **Step 3: Confirm the app is at the default-shadcn baseline and tests pass**

```bash
cd web && npx tsc --noEmit && npm test
```
Expected: both clean. Commit nothing (no changes).

---

### Task 1: Theme tokens + motion utilities in `globals.css`

**Files:**
- Modify: `web/src/app/globals.css` (full replacement below)

**Interfaces:**
- Produces: Tailwind color utilities `bg-primary`, `bg-accent`, `bg-success`, `bg-success-bg`, `bg-destructive-bg`, `text-streak`, `bg-streak-bg`, `text-caption`, `text-h1/h2/display/body`; animation utilities `animate-shake`, `animate-pop`, `animate-progress-fill`, `animate-flame`; flip utilities `perspective-flip`, `flip-inner`, `flip-inner-flipped`, `backface-hidden`, `rotate-y-180`; glow utilities `shadow-primary-glow`, `shadow-accent-glow`, `shadow-success-glow`; easing var `--ease-standard`. Every later task uses these.

- [ ] **Step 1: Replace the body of `globals.css`** — keep the existing three `@import` lines and `@custom-variant dark` at the top, then replace everything below them with:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-be-vietnam-pro);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-destructive-bg: var(--destructive-bg);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-success-bg: var(--success-bg);
  --color-streak: var(--streak);
  --color-streak-foreground: var(--streak-foreground);
  --color-streak-bg: var(--streak-bg);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);

  /* Type scale (design doc §02 — Chữ) */
  --text-display: 2.75rem;
  --text-display--line-height: 1.05;
  --text-display--letter-spacing: -0.03em;
  --text-h1: 1.875rem;
  --text-h1--line-height: 1.15;
  --text-h1--letter-spacing: -0.02em;
  --text-h2: 1.375rem;
  --text-h2--line-height: 1.25;
  --text-h2--letter-spacing: -0.01em;
  --text-body: 1rem;
  --text-body--line-height: 1.6;
  --text-caption: 0.8125rem;
  --text-caption--line-height: 1.4;

  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
}

:root {
  --background: oklch(0.985 0.004 286);
  --foreground: oklch(0.24 0.02 286);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.24 0.02 286);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.24 0.02 286);
  --primary: oklch(0.55 0.19 274);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.96 0.03 276);
  --secondary-foreground: oklch(0.42 0.16 274);
  --muted: oklch(0.965 0.006 286);
  --muted-foreground: oklch(0.55 0.02 286);
  --accent: oklch(0.68 0.18 29);
  --accent-foreground: oklch(0.99 0 0);
  --success: oklch(0.66 0.15 150);
  --success-foreground: oklch(0.99 0 0);
  --success-bg: oklch(0.96 0.04 150);
  --destructive: oklch(0.62 0.16 18);
  --destructive-bg: oklch(0.96 0.035 18);
  --streak: oklch(0.78 0.15 78);
  --streak-foreground: oklch(0.5 0.11 70);
  --streak-bg: oklch(0.96 0.05 82);
  --border: oklch(0.92 0.008 286);
  --input: oklch(0.92 0.008 286);
  --ring: oklch(0.55 0.19 274);
  --chart-1: oklch(0.55 0.19 274);
  --chart-2: oklch(0.68 0.18 29);
  --chart-3: oklch(0.66 0.15 150);
  --chart-4: oklch(0.78 0.15 78);
  --chart-5: oklch(0.55 0.02 286);
  --radius: 0.625rem;
  --sidebar: oklch(1 0 0);
  --sidebar-foreground: oklch(0.24 0.02 286);
  --sidebar-primary: oklch(0.55 0.19 274);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --sidebar-accent: oklch(0.96 0.03 276);
  --sidebar-accent-foreground: oklch(0.42 0.16 274);
  --sidebar-border: oklch(0.92 0.008 286);
  --sidebar-ring: oklch(0.55 0.19 274);
}

.dark {
  --background: oklch(0.2 0.02 286);
  --foreground: oklch(0.95 0.006 286);
  --card: oklch(0.245 0.02 286);
  --card-foreground: oklch(0.95 0.006 286);
  --popover: oklch(0.245 0.02 286);
  --popover-foreground: oklch(0.95 0.006 286);
  --primary: oklch(0.7 0.15 276);
  --primary-foreground: oklch(0.18 0.02 286);
  --secondary: oklch(0.3 0.03 276);
  --secondary-foreground: oklch(0.9 0.03 276);
  --muted: oklch(0.28 0.02 286);
  --muted-foreground: oklch(0.68 0.015 286);
  --accent: oklch(0.74 0.15 32);
  --accent-foreground: oklch(0.18 0.02 286);
  --success: oklch(0.72 0.14 152);
  --success-foreground: oklch(0.18 0.02 286);
  --success-bg: oklch(0.3 0.06 152);
  --destructive: oklch(0.7 0.14 20);
  --destructive-bg: oklch(0.32 0.07 20);
  --streak: oklch(0.82 0.14 80);
  --streak-foreground: oklch(0.22 0.05 80);
  --streak-bg: oklch(0.32 0.07 82);
  --border: oklch(0.32 0.015 286);
  --input: oklch(0.34 0.015 286);
  --ring: oklch(0.7 0.15 276);
  --chart-1: oklch(0.7 0.15 276);
  --chart-2: oklch(0.74 0.15 32);
  --chart-3: oklch(0.72 0.14 152);
  --chart-4: oklch(0.82 0.14 80);
  --chart-5: oklch(0.68 0.015 286);
  --sidebar: oklch(0.22 0.02 286);
  --sidebar-foreground: oklch(0.95 0.006 286);
  --sidebar-primary: oklch(0.7 0.15 276);
  --sidebar-primary-foreground: oklch(0.18 0.02 286);
  --sidebar-accent: oklch(0.3 0.03 276);
  --sidebar-accent-foreground: oklch(0.9 0.03 276);
  --sidebar-border: oklch(0.32 0.015 286);
  --sidebar-ring: oklch(0.7 0.15 276);
}

/* Wrong-answer feedback shake. */
@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}
@utility animate-shake { animation: shake 0.4s ease-in-out; }

/* Correct-answer feedback: 1.14x pop. */
@keyframes pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.14); }
  100% { transform: scale(1); }
}
@utility animate-pop { animation: pop 0.32s var(--ease-standard); }

/* Progress-bar fill on mount/update. */
@keyframes progress-fill { from { width: 0%; } }
@utility animate-progress-fill { animation: progress-fill 0.9s var(--ease-standard); }

/* Streak flame idle loop. */
@keyframes flame {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
@utility animate-flame { animation: flame 1.6s ease-in-out infinite; }

/* Flashcard flip (rotateY, 320ms). Pair `perspective-flip` on the wrapper
   with `.flip-inner` and two children each `absolute inset-0
   backface-hidden`, the back one also `rotate-y-180`. */
@utility perspective-flip { perspective: 900px; }
@utility flip-inner {
  transform-style: preserve-3d;
  transition: transform 0.32s var(--ease-standard);
}
@utility flip-inner-flipped { transform: rotateY(180deg); }
@utility backface-hidden { backface-visibility: hidden; }
@utility rotate-y-180 { transform: rotateY(180deg); }

/* CTA glow shadows (design doc §03 — độ nổi). */
@utility shadow-primary-glow { box-shadow: 0 8px 20px oklch(from var(--primary) l c h / 28%); }
@utility shadow-accent-glow { box-shadow: 0 8px 20px oklch(from var(--accent) l c h / 28%); }
@utility shadow-success-glow { box-shadow: 0 8px 20px oklch(from var(--success) l c h / 28%); }

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
  html { @apply font-sans; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Verify it compiles and renders**

```bash
cd web && npx tsc --noEmit && npm run dev &
```
Open `http://localhost:3000/login` — background should be near-white lavender-tinted, primary buttons indigo-violet. Kill the dev server after checking.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/globals.css
git commit -m "feat(web): indigo-violet/coral design tokens, type scale, motion utilities"
```

---

### Task 2: Be Vietnam Pro font + dark-mode plumbing in root layout

**Files:**
- Modify: `web/src/app/layout.tsx` (full replacement below)
- Create: `web/src/app/providers.tsx`

**Interfaces:**
- Produces: `--font-be-vietnam-pro` CSS var consumed by `--font-sans` (Task 1); `<Providers>` wrapper that applies `class="dark"` on `<html>` via next-themes. `useTheme()` becomes available to any client component (used by Task 14's settings toggle).

- [ ] **Step 1: Install next-themes**

```bash
cd web && npm install next-themes
```

- [ ] **Step 2: Create `web/src/app/providers.tsx`**

```tsx
"use client";

import { ThemeProvider } from "next-themes";

/** Client-side app providers. next-themes stamps `class="dark"` on <html>
 * (matching globals.css's `@custom-variant dark`), follows the OS by
 * default, and persists an explicit user choice from the settings toggle. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Replace `web/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Học tiếng Anh",
  description: "Nền tảng luyện thi IELTS và học tiếng Anh theo lộ trình cá nhân hoá.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes mutates <html> class before hydration.
    <html lang="vi" suppressHydrationWarning>
      <body className={`${beVietnamPro.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; run dev server, confirm Vietnamese diacritics render cleanly in Be Vietnam Pro (compare against shot `03-shot.png`), and that adding `class="dark"` to `<html>` in devtools flips the palette.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/layout.tsx web/src/app/providers.tsx web/package.json web/package-lock.json
git commit -m "feat(web): Be Vietnam Pro font + next-themes dark-mode plumbing"
```

---

### Task 3: Button variants (`accent`, `success`, glow) + ≥44px hit targets

**Files:**
- Modify: `web/src/components/ui/button.tsx`

**Interfaces:**
- Produces: `<Button variant="accent" | "success">`; `buttonVariants({ variant, size })` for `Link`-styled-as-button usage; sizes where `default` = 44px tall. All screen tasks consume these.

- [ ] **Step 1: Update the cva variants.** In `web/src/components/ui/button.tsx`, replace the `variants.variant` and `variants.size` maps with:

```ts
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-primary-glow hover:bg-primary/90",
        accent:
          "bg-accent text-accent-foreground shadow-accent-glow hover:bg-accent/90",
        success:
          "bg-success text-success-foreground shadow-success-glow hover:bg-success/90",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // A11y rule (spec §3): primary tap targets ≥44px ⇒ default/lg/icon
        // hit that; `sm`/`xs` are for secondary inline/desktop-dense actions only.
        default: "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-[min(var(--radius-md),12px)] px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12",
      },
```

Keep the base cva string, `defaultVariants`, and the `Button` wrapper exactly as they are (base already includes `focus-visible:ring-3 focus-visible:ring-ring/50`, which is the spec's primary focus ring).

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; on `/login` the CTA is indigo with a soft violet glow, ~44px tall; compare with shot `04-shot.png` (variant row).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ui/button.tsx
git commit -m "feat(web): accent/success button variants, CTA glow, 44px hit targets"
```

---

### Task 4: `LessonNode` — shared 4-state lesson pill

**Files:**
- Create: `web/src/components/lesson-node.tsx`

**Interfaces:**
- Produces: `LessonNode({ state: LessonNodeState; label: string; href?: string; title?: string; className?: string })` and `type LessonNodeState = "COMPLETED" | "UNLOCKED" | "LOCKED" | "SKIPPED"` — matching the Prisma `LessonStatus`-derived states returned by `getLessonStates()` in `web/src/lib/progress.ts`. Task 6 (dashboard `LessonMap`) consumes it.

- [ ] **Step 1: Create `web/src/components/lesson-node.tsx`**

```tsx
import Link from "next/link";

import { cn } from "@/lib/utils";

export type LessonNodeState = "COMPLETED" | "UNLOCKED" | "LOCKED" | "SKIPPED";

const NODE_META: Record<
  LessonNodeState,
  { icon: string; pill: string; badge: string; label: string; clickable: boolean }
> = {
  COMPLETED: {
    icon: "✓",
    pill: "border-success/40 bg-success-bg",
    badge: "bg-success text-success-foreground",
    label: "text-[oklch(0.4_0.1_150)]",
    clickable: true,
  },
  UNLOCKED: {
    icon: "▶",
    pill: "border-primary bg-primary shadow-primary-glow",
    badge: "bg-white text-primary",
    label: "text-primary-foreground",
    clickable: true,
  },
  SKIPPED: {
    icon: "⏭",
    pill: "border-dashed border-border bg-card",
    badge: "bg-muted text-muted-foreground",
    label: "text-muted-foreground",
    clickable: true,
  },
  LOCKED: {
    icon: "🔒",
    pill: "border-border bg-muted cursor-not-allowed",
    badge: "bg-muted-foreground/25 text-muted-foreground",
    label: "text-muted-foreground",
    clickable: false,
  },
};

/**
 * Shared 4-state lesson node (done / unlocked / locked / skipped): a pill
 * with a leading state icon-circle (design doc §05 "node dạng viên thuốc").
 * Used across the dashboard timeline and any other lesson listing.
 */
export function LessonNode({
  state,
  label,
  href,
  title,
  className,
}: {
  state: LessonNodeState;
  label: string;
  href?: string;
  title?: string;
  className?: string;
}) {
  const meta = NODE_META[state];
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
          meta.badge,
        )}
      >
        {meta.icon}
      </span>
      <span className={cn("text-sm font-semibold", meta.label)}>{label}</span>
    </>
  );

  const pillClassName = cn(
    "inline-flex min-h-11 items-center gap-[11px] rounded-full border px-[18px] py-2.5 transition-transform",
    meta.pill,
    className,
  );

  if (!meta.clickable || !href) {
    return (
      <span className={pillClassName} title={title}>
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={cn(pillClassName, "hover:scale-[1.02]")} title={title}>
      {content}
    </Link>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` (component is not yet imported; that's Task 6).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/lesson-node.tsx
git commit -m "feat(web): shared 4-state LessonNode pill component"
```

---

### Task 5: Desktop sidebar shell (≥1024px) + app layout

**Files:**
- Create: `web/src/components/AppSidebar.tsx`
- Modify: `web/src/app/(app)/layout.tsx`
- Modify: `web/src/components/AppHeader.tsx` (accept `className` prop only)

**Interfaces:**
- Consumes: existing `LogoutButton` (`web/src/components/LogoutButton.tsx`) — check its props; if it doesn't accept `variant`/`className`, extend it to forward them to `Button`.
- Produces: `AppSidebar()` (no props). Layout contract: below `lg` only `AppHeader` renders; at `lg:` only the sidebar renders and `<main>` gets `lg:pl-64`.

- [ ] **Step 1: Create `web/src/components/AppSidebar.tsx`** (nav per shot `17-shot.png`: Lộ trình · Luyện nghe · Đề IELTS · Cài đặt — same real top-level routes as `AppHeader`; "Từ vựng" in the mockup has no standalone route, so omit it):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Headphones, GraduationCap, Settings } from "lucide-react";

import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Lộ trình", icon: Home },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/ielts", label: "Đề IELTS", icon: GraduationCap },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

/** Fixed left sidebar for the ≥1024px desktop shell (design doc §13): logo,
 * vertical nav, logout pinned at the bottom. Hidden below `lg:`, where
 * `AppHeader`'s horizontal nav is the only nav surface — the two never render
 * at the same time. Client component: active-route highlighting needs
 * `usePathname()`. */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-border bg-card lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          H
        </span>
        <span className="text-sm font-bold tracking-tight">Học tiếng Anh</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <LogoutButton variant="ghost" className="w-full" />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Rewire `web/src/app/(app)/layout.tsx`** — keep its doc comment about per-page auth, change only the JSX:

```tsx
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppSidebar />
      <AppHeader className="lg:hidden" />
      <main className="flex-1 lg:pl-64">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Make `AppHeader` accept `className`** — add a `className?: string` prop merged onto its root `<header>` with `cn(...)`. Restyle its bar: `border-b border-border bg-card`, logo mark as in the sidebar, streak chip `🔥 N` in `bg-streak-bg text-streak-foreground` rounded-full when streak data exists (design shot 09 header). Do not change its nav links or logout logic.

- [ ] **Step 4: Verify** — dev server: at <1024px only the top header shows; at ≥1024px only the sidebar shows and content clears it (compare shot `17-shot.png`). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AppSidebar.tsx web/src/app/\(app\)/layout.tsx web/src/components/AppHeader.tsx web/src/components/LogoutButton.tsx
git commit -m "feat(web): fixed desktop sidebar shell, header confined to mobile"
```

---

### Task 6: Dashboard — phase timeline + 2-column desktop

**Files:**
- Modify: `web/src/app/(app)/dashboard/page.tsx`
- Modify: `web/src/components/LessonMap.tsx`

**Interfaces:**
- Consumes: `LessonNode`/`LessonNodeState` (Task 4), `buttonVariants` (Task 3), existing `getLessonStates()` map.
- Produces: nothing new — pure restyle. **Keep every db query, `nextUp` computation, and prop untouched.**

- [ ] **Step 1: Restyle `LessonMap.tsx`** as a vertical timeline (shot `09-shot.png`): a left rail (`absolute left-[14px] w-0.5 bg-border`) with one circular timeline dot per phase; each phase is a `Card`-like block:
  - active phase (contains an `UNLOCKED` lesson): `border-primary bg-primary/5 shadow-primary-glow` wrapper, timeline dot `bg-primary ring-4 ring-primary/20`;
  - completed phase: dot `bg-success text-success-foreground` with ✓;
  - locked phase (all lessons locked): wrapper `opacity-70`, dot `bg-muted` with 🔒, count `0/N`;
  - header row: `GĐ {n} · {phase.title}` (font-bold) + `{done}/{total}` on the right in `text-primary font-bold`;
  - a progress bar `h-1.5 rounded-full bg-muted` with inner `h-full rounded-full bg-primary animate-progress-fill` at `width: {percent}%` (full `bg-success` when complete);
  - lessons rendered as `<LessonNode state={states.get(lesson.id) ?? "LOCKED"} label={\`Bài ${lesson.orderIndex}\`} title={lesson.title} href={...}/>` in a `flex flex-wrap gap-2` row.
  State mapping and hrefs must reuse whatever the current `LessonMap` already computes — restyle the JSX around the existing logic.

- [ ] **Step 2: Restyle `dashboard/page.tsx`** — keep lines 1–73 (imports, queries, `nextUp`, percentages) identical; replace only the returned JSX with the 2-column layout:

```tsx
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
      <div className="max-w-3xl lg:max-w-none">
        <h2 className="mb-1 text-h2 font-extrabold tracking-tight">
          {user.name ? `Chào ${user.name} 👋` : "Chào bạn 👋"}
        </h2>
        {subtitleParts.length > 0 ? (
          <p className="mb-6 text-caption text-muted-foreground">{subtitleParts.join(" · ")}</p>
        ) : null}

        {prompt === "placement" ? (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Bạn chưa làm bài kiểm tra đầu vào — làm bài để chúng tôi đánh giá đúng
              trình độ hiện tại của bạn.
            </p>
            <Link
              href="/onboarding/placement"
              className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
            >
              Làm bài kiểm tra đầu vào
            </Link>
          </div>
        ) : null}

        <LessonMap phases={phases} states={states} />
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:mt-0">
        {nextUp ? (
          <div className="rounded-xl bg-primary p-4 text-primary-foreground shadow-primary-glow">
            <p className="mb-2 text-xs font-medium opacity-80">Việc hôm nay</p>
            <p className="mb-3 font-semibold">
              {nextUp.phaseTitle} · {nextUp.lesson.title}
            </p>
            <Link
              href={`/learn/${nextUp.phaseSlug}/${nextUp.lesson.slug}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none")}
            >
              Tiếp tục học →
            </Link>
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tuần này</p>
          <p className="text-sm">
            Bài đã hoàn thành:{" "}
            <span className="font-semibold text-foreground">{lessonsCompletedThisWeek}</span>
          </p>
        </div>
      </div>
    </div>
  );
```

(If HEAD's page lacks the `lessonsCompletedThisWeek` count or `nextUp`, derive them exactly as above from the already-fetched `phases`/`states` — a `db.lessonProgress.count` for the week is an additive read-only query, allowed.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test`; visual vs shots `09-shot.png` (mobile) and `17-shot.png` (desktop 2-col).

- [ ] **Step 4: Commit** — `git commit -m "feat(web): dashboard phase timeline with LessonNode pills + 2-col desktop"`

---

### Task 7: `LessonTabs` + lesson reader restyle

**Files:**
- Create: `web/src/components/LessonTabs.tsx`
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx` (lecture), `…/vocab/page.tsx`, `…/exercise/page.tsx` — headers only
- Modify: `web/src/components/MarkdownContent.tsx` — reader typography

**Interfaces:**
- Produces: `LessonTabs({ phaseTitle, lessonTitle, basePath, active: "lecture" | "vocab" | "exercise" })`; `basePath` = `/learn/[phase]/[lesson]`.

- [ ] **Step 1: Create `web/src/components/LessonTabs.tsx`**

```tsx
import Link from "next/link";

import { cn } from "@/lib/utils";

type LessonTabKey = "lecture" | "vocab" | "exercise";

const TAB_DEFS: { key: LessonTabKey; label: string; suffix: string }[] = [
  { key: "lecture", label: "Bài giảng", suffix: "" },
  { key: "vocab", label: "Từ vựng", suffix: "/vocab" },
  { key: "exercise", label: "Bài tập", suffix: "/exercise" },
];

/**
 * Shared header for the three lesson-scoped pages (design doc §06): back-link,
 * phase + lesson title, and the 3-tab bar. Active tab gets a primary
 * underline. `basePath` is the lecture page's own URL.
 */
export function LessonTabs({
  phaseTitle,
  lessonTitle,
  basePath,
  active,
}: {
  phaseTitle: string;
  lessonTitle: string;
  basePath: string;
  active: LessonTabKey;
}) {
  return (
    <>
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-caption text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Quay lại lộ trình học
      </Link>

      <p className="text-caption font-semibold text-primary">{phaseTitle}</p>
      <h1 className="mb-4 text-h1 font-extrabold tracking-tight text-foreground">{lessonTitle}</h1>

      <div className="mb-6 flex gap-1 border-b border-border">
        {TAB_DEFS.map((tab) => (
          <Link
            key={tab.key}
            href={`${basePath}${tab.suffix}`}
            className={cn(
              "min-h-11 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              active === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Swap each of the three lesson pages' ad-hoc headers for `<LessonTabs …/>`** with the correct `active` key. Data loading in each page stays untouched.

- [ ] **Step 3: Restyle `MarkdownContent.tsx`** (shot `10-shot.png`): body `text-body leading-relaxed`; `h2/h3` bold tracking-tight with generous top margin; inline `code`/`pre` in `bg-secondary text-secondary-foreground font-mono rounded-lg px-3 py-2`; tables full-width, header row `bg-muted text-caption font-semibold`, cells `border-border px-3 py-2`; wrap tables in `overflow-x-auto`; bold text stays `text-foreground`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; open a lesson (e.g. `/learn/phase-2/…` from dashboard), compare with shot `10-shot.png`; tab switching works.

- [ ] **Step 5: Commit** — `git commit -m "feat(web): LessonTabs shared header + markdown reader restyle"`

---

### Task 8: Exercise runner states

**Files:**
- Modify: `web/src/components/ExerciseRunner.tsx`, `web/src/components/runner/QuestionCard.tsx`, `web/src/components/runner/ExplanationSlot.tsx`
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx` (wrap with LessonTabs already done in Task 7)

**Interfaces:**
- Consumes: `animate-shake` / `animate-pop` utilities (Task 1), `Button` variants (Task 3). The runner reducer (`web/src/components/runner/reducer.ts`) and its `QuestionStatus`/phase model are **read-only** — restyle maps existing statuses to classes.

- [ ] **Step 1: Runner chrome** (shot `11-shot.png`): top bar = close `✕` (`buttonVariants({variant:"ghost",size:"icon-sm"})` linking back to the lesson) + progress track (`h-2 flex-1 rounded-full bg-muted` with `bg-primary animate-progress-fill` inner) + `n/total` caption. Above the prompt a kicker `Chọn đáp án đúng` / `Điền vào chỗ trống` in `text-caption font-semibold text-primary`.

- [ ] **Step 2: MCQ option states in `QuestionCard.tsx`** — style the option `<button>`s with this exact state→class mapping (keep all selection/`wrongLabel` logic identical):

```tsx
className={cn(
  "flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors disabled:opacity-70",
  isSelected && !isWrong && !isCorrectPick && "border-primary bg-primary/10",
  !isSelected && "border-border hover:bg-muted",
  isWrong && "animate-shake border-destructive bg-destructive-bg",
  isCorrectPick && "animate-pop border-success bg-success-bg",
)}
```

with a leading letter badge (`size-6 rounded-lg text-xs font-bold`): neutral `bg-muted text-muted-foreground`, selected `bg-primary text-primary-foreground`, wrong `bg-destructive/15 text-destructive` + trailing `✕`, correct `bg-success text-success-foreground` + trailing `✓`.

- [ ] **Step 3: Fill-blank inputs** — inline `input` per blank: `mx-1 inline-block w-28 rounded-lg border border-input bg-transparent px-2 py-1 text-center font-medium`, wrong ⇒ `animate-shake border-destructive bg-destructive-bg text-destructive`, correct ⇒ `animate-pop border-success bg-success-bg text-success`. Same treatment on the textarea fallback.

- [ ] **Step 4: Wrong-answer panel in `ExerciseRunner.tsx`** — when status is incorrect show the keyNote card (shot 11, right phone):

```tsx
<div className="rounded-xl border border-destructive/30 bg-destructive-bg p-4">
  <p className="mb-1 text-caption font-bold text-destructive">💡 Ghi nhớ</p>
  <p className="text-sm leading-relaxed">{keyNote}</p>
</div>
```

plus the AI `ExplanationSlot` beneath it (restyle as a `border-dashed border-primary/40 bg-primary/5 rounded-xl p-4` slot; its fetch/streaming logic untouched). Retry button = `variant="outline"`, next/check CTA = default variant, full-width on mobile.

- [ ] **Step 5: Completion screen** — big `✓` disc `size-16 rounded-full bg-success text-success-foreground animate-pop`, headline `text-h2 font-extrabold`, unlock line `Đã mở khoá: Bài {n+1}` as a `LessonNode`-style pill or `bg-streak-bg text-streak-foreground` chip, CTA back to dashboard (default variant) + "Làm lại" (`outline`).

- [ ] **Step 6: Verify** — `npm test` (reducer tests must pass unchanged); drive one exercise end-to-end in the browser: pick wrong answer → shake + Ghi nhớ card; correct → pop; finish → completion screen. Compare shot `11-shot.png`.

- [ ] **Step 7: Commit** — `git commit -m "feat(web): exercise runner state styling (wrong/correct/keyNote/unlock)"`

---

### Task 9: Vocab hub + flashcards / quiz / match

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/page.tsx` (hub) and `…/vocab/{flashcards,match,quiz}/page.tsx` (thin wrappers)
- Modify: `web/src/components/vocab/Flashcards.tsx`, `QuizGame.tsx`, `MatchGame.tsx`

**Interfaces:**
- Consumes: flip utilities + `animate-pop/shake/flame/progress-fill` (Task 1), `Button` `success`/`accent` variants (Task 3). Game logic in `web/src/components/vocab/games.ts` is read-only (`games.test.ts` guards it).

- [ ] **Step 1: Hub page** (shot `12-shot.png`, left phone): progress pill `Tiến độ ghi nhớ {learned}/{total}` as a full-width `rounded-full bg-primary text-primary-foreground px-5 py-3` bar with an inner lighter track; then `Chọn chế độ luyện tập` caption; then 3 mode cards (rows, `rounded-xl border-border bg-card p-4 hover:shadow-md`, each with an emoji tile `size-10 rounded-lg` in `bg-secondary` (🃏 Thẻ ghi nhớ), `bg-streak-bg` (⚡ Quiz trắc nghiệm · "4 đáp án · tính streak"), `bg-destructive-bg` (🧩 Ghép cặp), a title + caption, and a trailing `›`).

- [ ] **Step 2: Flashcards flip** — card wrapper `perspective-flip`; inner `relative h-64 w-full flip-inner` + `flip-inner-flipped` when flipped; front/back both `absolute inset-0 backface-hidden rounded-2xl border bg-card flex flex-col items-center justify-center gap-2 p-6`, back additionally `rotate-y-180 bg-primary text-primary-foreground`; word in `text-h1 font-extrabold`; progress bar `animate-progress-fill`; "đã nhớ" action uses `variant="success"`, "chưa nhớ" `variant="outline"`; hint `Nhấn để xem nghĩa ↻` in `text-caption text-muted-foreground`.

- [ ] **Step 3: Quiz** — reuse MCQ option styling from Task 8 Step 2 verbatim; streak chip `🔥 {streak}` in `bg-streak-bg text-streak-foreground rounded-full px-2.5 py-1 text-caption font-bold` with `animate-flame` on the emoji while streak ≥ 2.

- [ ] **Step 4: Match** — tile grid buttons `min-h-11 rounded-xl border text-sm font-medium`; selected `border-primary bg-primary/10`; matched `border-success/40 bg-success-bg text-success animate-pop` then fade to `opacity-40`; mismatch pair `animate-shake border-destructive bg-destructive-bg` (existing timeout logic untouched); timer chip top-right in `font-mono text-caption`.

- [ ] **Step 5: Verify** — `npm test` (games tests green); play all three modes in browser vs shot `12-shot.png`; check `prefers-reduced-motion` (devtools emulation) disables flip/shake.

- [ ] **Step 6: Commit** — `git commit -m "feat(web): vocab hub + flashcards/quiz/match gamified styling"`

---

### Task 10: Onboarding — path picker, placement wizard, result

**Files:**
- Modify: `web/src/app/onboarding/path/page.tsx`, `web/src/components/GoalPicker.tsx`
- Modify: `web/src/app/onboarding/placement/page.tsx`, `web/src/components/PlacementWizard.tsx`, `web/src/components/AudioPlayer.tsx`
- Modify: `web/src/app/onboarding/placement/result/page.tsx`

**Interfaces:**
- Consumes: `Button`, `buttonVariants`, tokens. Submission handlers / server actions unchanged.

- [ ] **Step 1: Path picker** (shot `06-shot.png`): slim progress bar on top (`h-1.5 rounded-full bg-muted` + `bg-primary` inner); `Mục tiêu của bạn?` in `text-h1 font-extrabold`; segmented control for "Theo band IELTS" / "Theo CEFR" (`rounded-full bg-muted p-1`, active segment `rounded-full bg-card font-bold shadow-sm`); IELTS mode = 3-col grid of band chips (`aspect-square rounded-2xl border bg-card text-h2 font-bold`, selected `border-primary bg-primary text-primary-foreground shadow-primary-glow` with a `Phổ biến` sub-caption on 6.5); CEFR mode = stacked cards each with a level badge (`size-9 rounded-lg bg-primary text-primary-foreground font-bold` when selected, `bg-muted` otherwise), name + description, selected card `border-primary bg-secondary/60` with a trailing primary dot.

- [ ] **Step 2: Placement wizard** (shot `07-shot.png`): 3-step stepper Nghe → Đọc → Viết — circles `size-8 rounded-full font-bold` (done `bg-success text-success-foreground` ✓ · current `bg-primary text-primary-foreground` · upcoming `bg-muted text-muted-foreground`), connecting lines `h-0.5 flex-1 bg-border` (`bg-primary` once passed), labels beneath in `text-caption`. Listening step: audio card `rounded-2xl border border-primary/25 bg-secondary/50 p-4` with round primary play button (`size-12 rounded-full bg-primary text-primary-foreground`), progress track and `🎧 Nghe tối đa 2 lần` caption (restyle `AudioPlayer` accordingly — its play-count logic untouched). Reading step: passage in a `ĐOẠN VĂN`-labelled card. Question counter `Câu {i}/{n}` as caption; options reuse Task 8's MCQ styling.

- [ ] **Step 3: Result** (shot `08-shot.png`): hero `rounded-b-3xl bg-primary px-6 py-10 text-center text-primary-foreground` — caption `Trình độ hiện tại của bạn`, band in `text-[64px] font-extrabold leading-none`, chip `Tương đương CEFR {level}` in `rounded-full bg-white/15 px-3 py-1 text-caption`; then `Chi tiết từng kỹ năng` list — each row: skill emoji+name, score right-aligned `font-bold`, bar `h-2 rounded-full bg-muted` with inner `animate-progress-fill` colored `bg-primary` (nghe/đọc) or `bg-destructive` for the weakest skill as in the mockup — use `bg-primary` for all except the minimum score, which gets `bg-destructive`; CTA `Bắt đầu lộ trình` default variant `size="lg"` full-width.

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm test`; walk `/onboarding/path` → placement → result in browser vs shots 06–08.

- [ ] **Step 5: Commit** — `git commit -m "feat(web): onboarding path/placement/result restyle"`

---

### Task 11: Login + verify (OTP)

**Files:**
- Modify: `web/src/app/(auth)/login/page.tsx`, `web/src/app/(auth)/login/verify/page.tsx`

- [ ] **Step 1: Login** (shot `05-shot.png`, left): centered column `mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6`; logo mark `size-12 rounded-2xl bg-primary text-primary-foreground text-xl font-bold shadow-primary-glow` ("H"); `Chào mừng trở lại 👋` in `text-h1 font-extrabold`; helper copy `text-body text-muted-foreground`; labelled email input (`ui/input` inherits tokens); submit `Gửi mã đăng nhập` default variant full-width.

- [ ] **Step 2: Verify** (shot `05-shot.png`, right): back button `←` (`buttonVariants({variant:"secondary",size:"icon"})`); `Nhập mã 6 số` heading; sent-to line with the email in `font-semibold text-foreground`; **OTP boxes**: 6 single-char inputs

```tsx
<input
  inputMode="numeric"
  maxLength={1}
  className="size-12 rounded-xl border border-input bg-card text-center text-h2 font-bold outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
/>
```

with auto-advance on input and backspace-to-previous (local `useRef` array — pure UI; the composed 6-digit string feeds the existing submit exactly as the current single input does). Resend line `Chưa nhận được mã? Gửi lại sau 0:42` — countdown display only if a resend timer already exists; do not add resend logic if absent.

- [ ] **Step 3: Verify** — request a code with `OTP_DEV_ECHO=true`, complete login in browser; compare shot 05. `npm test` (otp tests untouched).

- [ ] **Step 4: Commit** — `git commit -m "feat(web): login + OTP verify restyle"`

---

### Task 12: Listening hub + player

**Files:**
- Modify: `web/src/app/(app)/listening/page.tsx`, `web/src/app/(app)/listening/[slug]/page.tsx`
- Modify: `web/src/components/ListeningSetView.tsx`, `web/src/components/ListeningRunner.tsx`, `web/src/components/AudioPlayer.tsx` (full-player mode)

- [ ] **Step 1: Hub list** (shot `13-shot.png`, right phone): each set = row card with a `size-10 rounded-xl` state tile — done `bg-success-bg text-success` ✓ · in-progress `bg-primary text-primary-foreground` ▶ with card `border-primary bg-secondary/40` · not-started `bg-muted` 🎧 · locked `bg-muted opacity-60` 🔒 with muted title; meta line `{level} · {duration} · {progress}` in `text-caption text-muted-foreground`.

- [ ] **Step 2: Full player** (shot `13-shot.png`, left phone): `rounded-2xl bg-primary p-5 text-primary-foreground shadow-primary-glow` block containing: thin progress track (`bg-white/25` with `bg-white` fill) + time labels `font-mono text-xs opacity-80`; center row `−10` / play-pause (`size-14 rounded-full bg-white text-primary`) / `+10` (`size-9 rounded-full bg-white/15`); speed chips `0.75× 1.0× 1.25×` (`rounded-full px-2.5 py-0.5 text-xs font-semibold`, active `bg-white text-primary`, rest `bg-white/15`). All wired to the existing `<audio>` ref handlers — seek/rate logic already exists or is trivial `currentTime += 10` / `playbackRate = x` UI wiring.

- [ ] **Step 3: Questions below player** reuse Task 8 styling; transcript accordion = `details` styled `rounded-xl border bg-card` with `summary` `min-h-11 px-4 font-semibold`.

- [ ] **Step 4: Verify** — play a set end-to-end; `npm test`; compare shot 13.

- [ ] **Step 5: Commit** — `git commit -m "feat(web): listening hub + primary player card restyle"`

---

### Task 13: IELTS grid + test detail

**Files:**
- Modify: `web/src/app/(app)/ielts/page.tsx`, `web/src/app/(app)/ielts/[n]/page.tsx`
- Modify: `web/src/components/AnswerKeyAccordion.tsx`

- [ ] **Step 1: Grid** (shot `14-shot.png`, left): `Đề luyện IELTS` display heading; skill tabs Reading/Writing/Speaking as the segmented control from Task 10 Step 1; test tiles `grid grid-cols-4 gap-3 sm:grid-cols-6` — each `aspect-square rounded-2xl border bg-card flex flex-col items-center justify-center`: number `text-h2 font-bold`; scored ⇒ `border-success/40 bg-success-bg` with band beneath in `text-caption font-bold text-success`; in-progress ⇒ `border-primary` + top-right `size-2 rounded-full bg-accent` dot + `dở dang` caption; untouched ⇒ plain.

- [ ] **Step 2: Detail** (shot `14-shot.png`, right): header `Đề {NN} · Reading` + `40 câu · 60 phút` caption; passage cards `rounded-2xl border bg-card p-5`; **answer-key accordion** in warning amber:

```tsx
<details className="overflow-hidden rounded-xl border border-streak/50 bg-streak-bg">
  <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 font-bold text-streak-foreground">
    ⚠️ Đáp án & giải thích
  </summary>
  <div className="border-t border-streak/30 px-4 py-3 text-sm">
    <p className="mb-3 text-streak-foreground">
      Chỉ mở khi bạn đã tự làm xong. Xem trước sẽ giảm hiệu quả luyện tập.
    </p>
    {/* existing key content, unchanged */}
  </div>
</details>
```

- [ ] **Step 3: Verify** — `/ielts` and `/ielts/3` in browser vs shot 14; `npm test`.

- [ ] **Step 4: Commit** — `git commit -m "feat(web): IELTS grid badges + amber answer-key accordion"`

---

### Task 14: Settings + dark-mode toggle

**Files:**
- Create: `web/src/components/ui/switch.tsx`, `web/src/components/ThemeToggleRow.tsx`
- Modify: `web/src/app/(app)/settings/page.tsx`, `web/src/components/SettingsGoalForm.tsx` (token classes only)

**Interfaces:**
- Consumes: `useTheme()` from next-themes (provider mounted in Task 2); `@base-ui/react/switch` (already a dependency via `@base-ui/react`).

- [ ] **Step 1: Create `web/src/components/ui/switch.tsx`**

```tsx
"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted-foreground/30 p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
```

- [ ] **Step 2: Create `web/src/components/ThemeToggleRow.tsx`** (shot `15-shot.png`: "🌙 Giao diện tối" row)

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Switch } from "@/components/ui/switch";

/** Settings row toggling dark mode. Renders the switch only after mount:
 * the server doesn't know the stored theme, so this avoids a hydration
 * mismatch on `checked`. */
export function ThemeToggleRow() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-secondary text-base">
          🌙
        </span>
        <p className="text-sm font-semibold">Giao diện tối</p>
      </div>
      {mounted ? (
        <Switch
          checked={resolvedTheme === "dark"}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          aria-label="Bật giao diện tối"
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Restyle settings page** (shot 15): profile hero `rounded-2xl bg-primary p-4 text-primary-foreground shadow-primary-glow` — avatar disc `size-11 rounded-xl bg-white/20 font-bold`, name + email, streak `🔥 {n}` top-right with `streak` caption; below: action rows (same row-card pattern as ThemeToggleRow) for 🎯 Mục tiêu học (current goal caption, opens existing `SettingsGoalForm`), 🔄 Làm lại kiểm tra đầu vào (link to `/onboarding/placement`), then `<ThemeToggleRow />`, then logout as `variant="destructive"` full-width. All existing form/actions logic unchanged.

- [ ] **Step 4: Verify** — toggle dark mode: whole app flips (check dashboard against shot 15's dark preview); reload persists; `npx tsc --noEmit && npm test`.

- [ ] **Step 5: Commit** — `git commit -m "feat(web): settings restyle + dark-mode toggle (next-themes + base-ui switch)"`

---

### Task 15: Shared empty / loading / error / 404 states

**Files:**
- Create: `web/src/components/EmptyState.tsx`, `web/src/app/not-found.tsx`
- Modify: `web/src/components/ErrorState.tsx`, existing `loading.tsx`/`error.tsx` under `(app)`; Create missing `loading.tsx` for `(app)/ielts`, `(app)/listening`, `(app)/settings`

**Interfaces:**
- Produces: `EmptyState({ icon?, title, description, ctaHref?, ctaLabel? })`.

- [ ] **Step 1: Create `web/src/components/EmptyState.tsx`** (shot `16-shot.png`, left)

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Encouraging empty state (design doc §12): soft icon tile, headline,
 * supporting copy, optional CTA. */
export function EmptyState({
  icon = "🌱",
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  icon?: string;
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span aria-hidden className="flex size-24 items-center justify-center rounded-3xl bg-secondary text-5xl">
        {icon}
      </span>
      <h2 className="text-h2 font-extrabold">{title}</h2>
      {description ? (
        <p className="max-w-xs text-body text-muted-foreground">{description}</p>
      ) : null}
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className={cn(buttonVariants(), "mt-2")}>
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
```

Use it wherever a list can be empty (dashboard with no phases, listening hub, ielts grid) with copy like `Chưa có gì ở đây` / `Hoàn thành bài học đầu tiên để bắt đầu chuỗi streak của bạn 🔥`.

- [ ] **Step 2: Skeletons** — each `loading.tsx` mirrors its page's layout with `ui/skeleton.tsx` blocks (`rounded-xl`, heights matching the real cards; see shot 16 right phone). Create the missing ones for `ielts`, `listening`, `settings` routes.

- [ ] **Step 3: `web/src/app/not-found.tsx`**

```tsx
import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      icon="🧭"
      title="Không tìm thấy trang"
      description="Trang bạn tìm không tồn tại hoặc đã được chuyển đi."
      ctaHref="/dashboard"
      ctaLabel="Về lộ trình học"
    />
  );
}
```

- [ ] **Step 4: `ErrorState.tsx`** — same composition with `icon="⚠️"` on `bg-destructive-bg`, retry button `variant="outline"` calling the existing `reset()`.

- [ ] **Step 5: Verify** — visit a bogus URL for 404; throttle network to see skeletons; `npx tsc --noEmit`.

- [ ] **Step 6: Commit** — `git commit -m "feat(web): EmptyState, styled 404, skeleton loading states"`

---

### Task 16: Full-app verification pass

**Files:** none new — fixes only if checks fail.

- [ ] **Step 1: Static + logic gates**

```bash
cd web && npx tsc --noEmit && npm run lint && npm test && npm run build
```
Expected: all green. Any logic-test failure means a business-logic regression — fix by reverting the offending styling change, never by editing the test.

- [ ] **Step 2: Visual sweep (light)** — with the dev server running, use Playwright MCP to screenshot each route at 390×844 (mobile) and 1280×800 (desktop) and compare against the mapped shot per the table in Context: `/login`, `/login/verify`, `/onboarding/path`, `/onboarding/placement`, `/onboarding/placement/result`, `/dashboard`, one lesson (lecture/vocab/exercise), flashcards/quiz/match, `/listening` + one set, `/ielts` + `/ielts/1`, `/settings`.

- [ ] **Step 3: Visual sweep (dark)** — toggle Giao diện tối in settings, re-screenshot dashboard, runner (wrong+correct states), settings; verify contrast: body text vs background and `text-muted-foreground` vs `bg-card` must read clearly (AA); spot-check with devtools contrast picker.

- [ ] **Step 4: Motion + a11y** — devtools "emulate prefers-reduced-motion": flip/shake/flame effectively off; keyboard-tab through login and runner: 3px primary focus ring visible on every interactive element; tap targets: primary CTAs and lesson nodes ≥44px.

- [ ] **Step 5: Rerun repo index check (content untouched, should be clean)**

```bash
cd /home/ncd/learnspaces/learning_english && python3 scripts/build_index.py --check
```

- [ ] **Step 6: Final commit of any polish fixes**

```bash
git add -A web/src && git commit -m "polish(web): design-system verification fixes"
```

---

## Verification (end-to-end)

1. `cd web && npx tsc --noEmit && npm run lint && npm test && npm run build` — all clean.
2. `npm run dev`, then walk the full user journey in a browser: login (OTP echo) → onboarding path → placement → result → dashboard → lesson → exercise (wrong answer first, then correct) → vocab games → listening → ielts → settings → toggle dark → re-walk dashboard/runner in dark.
3. Compare every screen against `abc/code-export/screens/05…17-shot.png` (mapping table in Context). The bar: same structure, tokens, and states — not pixel-perfection.
4. Confirm `git diff main@{start}` touches only `web/` UI files + `package.json`/lock (next-themes) — no API routes, no `lib/` logic, no prisma, no content `.md`.

## Notes for the executor

- The stash from Task 0 (`git stash list` → "previous uncommitted design pass") is a reference implementation of most tasks. If stuck on a detail, `git stash show -p stash@{0} -- <file>` to peek — but implement per this plan, don't blind-apply the stash.
- `abc/` is design reference material only; never import from it and don't commit it as part of these tasks.
- This repo requires **one subagent at a time** — no parallel dispatch.
- shadcn here is built on `@base-ui/react`, not Radix — check base-ui docs for primitive APIs (`data-[checked]`, `Switch.Root/Thumb`, button `Props`).
