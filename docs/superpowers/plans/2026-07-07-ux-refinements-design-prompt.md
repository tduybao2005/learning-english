# Design Prompt — UX Refinements Round 2 (for Claude Design)

> Copy everything below this line into Claude Design as a single prompt.
> Reference screenshots live at the repo root: `bai_tap.png` (exercise runner),
> `bai_giang.png` (lecture page), `dashboard.png` (dashboard + sidebar),
> `lo_trinh.png` (learning-path phase rows on the dashboard).

---

## Who you are designing for

You are designing screens for **"Học tiếng Anh"** — a bilingual (Vietnamese UI,
English learning content) self-study web app targeting IELTS 6.5–8.0. Learners
follow a 5-phase lesson path (lecture → exercise), practice listening,
flashcards, and full IELTS practice tests (reading/writing/speaking). The app
is already built (Next.js 15 + Tailwind v4, mobile-first with a desktop pass at
≥1024px); your job is to redesign **eight specific areas** listed below. Produce
self-contained HTML/CSS mockups for each item, at **375px (mobile)** and
**1280px (desktop)** widths, in **both light and dark mode**, reusing the design
system below exactly — do not invent new colors, fonts, or radii.

**All UI copy must stay in Vietnamese** (the learning content inside pages is
English). Keep the existing friendly-but-focused Duolingo-adjacent tone.

## Existing design system (must reuse verbatim)

**Font:** Be Vietnam Pro (sans, used for both body and headings). Mono: Geist Mono.

**Type scale** (CSS custom properties already in the app):
- `--text-display` 2.75rem / lh 1.05 / ls -0.03em (hero only)
- `--text-h1` 1.875rem / lh 1.15 / ls -0.02em — page titles, extrabold
- `--text-h2` 1.375rem / lh 1.25 / ls -0.01em — section titles, bold
- `--text-body` 1rem / lh 1.6
- `--text-caption` 0.8125rem / lh 1.4 — kickers, meta text

**Color tokens (oklch), light → dark (`.dark` class):**

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.985 0.004 286)` | `oklch(0.2 0.02 286)` |
| `--foreground` | `oklch(0.24 0.02 286)` | `oklch(0.95 0.006 286)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.245 0.02 286)` |
| `--primary` (violet) | `oklch(0.55 0.19 274)` | `oklch(0.7 0.15 276)` |
| `--secondary` (violet tint) | `oklch(0.96 0.03 276)` | `oklch(0.3 0.03 276)` |
| `--muted` / `--muted-foreground` | `oklch(0.965 0.006 286)` / `oklch(0.55 0.02 286)` | `oklch(0.28 0.02 286)` / `oklch(0.68 0.015 286)` |
| `--accent` (orange) | `oklch(0.68 0.18 29)` | `oklch(0.74 0.15 32)` |
| `--success` / `--success-bg` | `oklch(0.66 0.15 150)` / `oklch(0.96 0.04 150)` | `oklch(0.72 0.14 152)` / `oklch(0.3 0.06 152)` |
| `--destructive` / `--destructive-bg` | `oklch(0.62 0.16 18)` / `oklch(0.96 0.035 18)` | `oklch(0.7 0.14 20)` / `oklch(0.32 0.07 20)` |
| `--streak` / `--streak-bg` (gold) | `oklch(0.78 0.15 78)` / `oklch(0.96 0.05 82)` | `oklch(0.82 0.14 80)` / `oklch(0.32 0.07 82)` |
| `--border` / `--input` | `oklch(0.92 0.008 286)` | `oklch(0.32 0.015 286)` / `oklch(0.34 0.015 286)` |

**Radii:** base `--radius: 0.625rem`; scale sm 0.6× · md 0.8× · lg 1× · xl 1.4× ·
2xl 1.8× · 3xl 2.2×. Cards typically use xl/2xl; pills use full rounding.

**Motion (already implemented, design states around them):**
- `animate-shake` 0.4s — wrong answer (applied to the input/option)
- `animate-pop` 0.32s scale-to-1.14 — correct answer
- `animate-progress-fill` 0.9s — progress bar fill on mount
- CTA glow shadows: `0 8px 20px <color>/28%` for primary/accent/success buttons
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`; respect `prefers-reduced-motion`

**Existing layout conventions:**
- Desktop shell: fixed left sidebar **232px** (`--card` background, border-right),
  content area beside it. Mobile: sticky top header with horizontal nav instead.
- Lesson/lecture reading column: max-width 680px, with a 220px table-of-contents
  rail on the right at ≥1024px.
- Exercise runner (desktop) is a distraction-free full-screen view: top bar =
  close ✕ + progress track + "Câu X/47" counter; question prompt centered,
  `--text-h2` bold.
- Question option rows / inputs: min-height 44px touch targets, rounded-xl,
  1px `--border`, selected = `--primary` border + 10% primary tint fill;
  wrong = destructive border/bg + shake; correct = success border/bg + pop.

---

## Design item 1 — Exercise runner layout rebalance (see `bai_tap.png`)

**Problem:** On desktop, the question card + answer field sit hard-left while
the single "Kiểm tra" button floats hard-right at the bottom of the viewport.
The screen reads as two disconnected corners with a huge empty middle.

**Design goals:**
- One centered content column (~680–760px max-width) on the runner's vertical
  axis containing, top to bottom: kicker line ("Trả lời câu hỏi" / "Chọn đáp án
  đúng" / "Điền vào chỗ trống"), the question card, feedback area, and the
  action button — all visually one group.
- The "Kiểm tra" button must feel attached to the card (e.g. right-aligned or
  full-width **within the same column**, or inside a card footer), never
  floating at the far edge of the viewport.
- Keep the existing top bar (✕ / progress track / "Câu X/47") full-width.
- Design all four button states in place: `Kiểm tra` (enabled/disabled),
  `Thử lại` (after wrong), `Tiếp tục` (after correct).
- Wrong-answer feedback ("💡 Ghi nhớ" note + explanation) currently jumps to a
  right-hand column; decide its new home so the layout doesn't reflow jarringly
  (e.g. slides in under the card).
- Mobile (375px) is currently fine — keep it a single column; only ensure the
  new desktop layout degrades to it naturally.

## Design item 2 — Error-correction question: retype the corrected sentence (see `bai_tap.png`)

> **Status: already designed by the product owner directly in Claude Design —
> treat that mockup as the source of truth.** This section stays as the
> written record of the agreed behavior.

**Problem:** Error-correction questions show a sentence like
`She don't like vegetables. → Lỗi: ______ → Sửa: ______` and a generic
unlabeled textarea. Learners don't know whether to type the error, the fix,
or both, and get marked wrong.

**Agreed behavior:**
- **One single input** (auto-growing textarea): the learner **retypes the
  entire sentence with the error corrected**, then submits.
- The `→ Lỗi: ______ → Sửa: ______` scaffold line is removed from the
  displayed prompt — the sentence to fix stands alone.
- Instructional copy makes the task unambiguous, e.g. helper caption
  `Gõ lại cả câu hoàn chỉnh sau khi sửa lỗi.` and placeholder
  `Gõ lại cả câu đã sửa...`.
- Keep the existing input states: wrong = destructive border/bg + shake,
  correct = success border/bg + pop.

## Design item 3 — Lecture page: remove the "Từ vựng" tab (see `bai_giang.png`)

The lesson page currently has three tabs: `Bài giảng / Từ vựng / Bài tập`.
Vocabulary already has its own hub in the sidebar ("Từ vựng"), so the lesson
tab is redundant. Redesign the lesson header with only **two tabs:
`Bài giảng` and `Bài tập`** (active tab = primary underline, as today). Keep
the back-link `← Quay lại lộ trình học`, the phase kicker, and the lesson `h1`.
Rebalance spacing so a 2-tab bar doesn't look sparse (e.g. tighter tab group,
or tabs as a small segmented control).

## Design item 4 — End-of-lecture CTA: "Làm bài tập →"

When the learner scrolls to the end of a lecture there is currently nothing —
a dead end. Design a **navigation CTA at the very end of the lecture content**
that takes them to that lesson's exercise:

- Label: `Làm bài tập →` (primary button, may use the primary glow shadow).
- Give it a distinct end-of-lesson zone: e.g. separated by a divider, optional
  encouraging caption line (`Đã đọc xong? Luyện tập ngay để mở khoá bài tiếp
  theo.`), centered in the 680px reading column.
- Design hover and focus-visible states explicitly.
- Works at 375px (full-width button) and ≥1024px (auto width, centered).

## Design item 5 — Sidebar: drop the "Cài đặt" nav item (see `dashboard.png`)

The desktop sidebar currently lists 5 nav items (Lộ trình, Luyện nghe, Đề
IELTS, Từ vựng, **Cài đặt**) *and* has a bottom profile card that also opens
Settings — two entrances to the same place. Redesign the sidebar with:

- Nav = 4 items only (Lộ trình, Luyện nghe, Đề IELTS, Từ vựng).
- The bottom profile card stays the single entrance to Settings. It shows:
  avatar letter, the **user's display name** (not their email — names are being
  added to accounts), and the band line (`Band 6.5` / `Chưa xếp hạng`).
- Add an affordance hinting the card is clickable/leads to settings (e.g. a
  subtle gear glyph or chevron on hover) since the explicit menu item is gone.
- Keep: 232px width, logo header, active-item style (primary tint pill).

## Design item 6 — IELTS test detail page: single-skill view

**Context:** The IELTS hub already has Reading/Writing/Speaking segmented tabs
and a numbered grid of 30 tests. Currently, opening a test shows **all three
skills again as inner tabs** — redundant. The new structure: the learner picks
the skill in the hub, then the test page shows **only that skill**.

Design the new test detail page (e.g. "Đề 05 — Reading"):

- Header: back-link that returns to the hub **with the same skill tab active**
  (`← Quay lại đề Reading`), test title `Đề 05`, a skill badge (Reading /
  Writing / Speaking), and the meta line for that skill
  (Reading: `40 câu · 60 phút`, Writing: `2 bài · 60 phút`, Speaking:
  `3 phần · 11-14 phút`).
- Body: a long-form markdown reading surface (passages, numbered questions,
  tables) inside a card — optimize line length and heading rhythm for long
  English text on both mobile and a 1280px desktop (consider the 680–760px
  reading column + generous margins).
- Footer: the answer-key zone as a collapsed accordion (`Đáp án tham khảo`)
  showing only this skill's key.
- Optional small affordance to jump to the same test's other skills (e.g.
  quiet secondary links `Writing · Speaking`), clearly subordinate — the page
  belongs to one skill.

## Design item 7 — Settings page: profile section with editable display name

Users will now set a display name when they create their account. The Settings
page (currently: violet profile banner with avatar letter + email + estimated
band, then goal accordion, placement retake row, theme toggle, logout) needs:

- The profile banner to lead with the **display name**, with the email as the
  secondary line.
- An editable **"Tên hiển thị"** control: either inline edit in the banner
  (pencil icon → input + save) or a new row/accordion consistent with the
  existing "Mục tiêu học" accordion pattern. Include field label, 1–50 char
  input, `Lưu` button, saved-confirmation state, and validation-error state
  (empty name).
- Must fit the existing stack visually (rounded-2xl cards, one accent banner,
  quiet rows).

## Design item 8 — Learning-path phase row: full lesson access (see `lo_trinh.png`)

**Problem:** On the dashboard, the active phase row shows the header
(`GĐ 1 · Giai đoạn 1: Nền tảng`), a `0/13` counter and a progress bar — but
below it only a **sliding window of 3-4 lesson pills** around the current
lesson (the code slices `activeIdx-1 … activeIdx+2`). A learner in a 13-lesson
phase sees only `Bài 1 / Bài 2 / Bài 3`: they can't see how many lessons lie
ahead, and once they've progressed they can't see or reopen earlier lessons
that scrolled out of the window.

**Design goals:**
- The **next lesson** stays the dominant, immediately clickable element (today:
  primary pill with a play icon — keep that state).
- **Every lesson of the active phase is viewable and clickable**: completed
  lessons clearly read as revisitable links (✓ state), locked ones clearly
  locked (🔒 state). Reuse the three existing pill states (completed ✓ /
  current ▶ / locked 🔒).
- Pick **one** primary pattern and design it fully (e.g. a horizontally
  scrollable pill row that snap-scrolls to the current lesson with edge-fade
  hints, or an expand/collapse "Xem tất cả 13 bài" row, or a wrapping pill
  grid). Show how 13 pills behave, not just 3.
- Keep the phase-row shell: header + `x/13` counter + progress bar, and the
  active-phase treatment (primary border + tinted background + glow).
- Completed and locked **phases** keep collapsing to single summary rows as
  today — only the active phase row is being redesigned.
- Must work at 375px and at 1280px inside the dashboard's existing desktop
  layout (content column + right rail with "Việc hôm nay" / "Tuần này" cards)
  without breaking it.

---

## Deliverables

For each of the 8 items: one HTML mockup file (self-contained CSS, both light
and dark via a `.dark` toggle, Vietnamese copy) shown at 375px and 1280px.
Annotate non-obvious interaction states (hover/focus/disabled/wrong/correct)
inline. Do not redesign screens outside these eight items.
