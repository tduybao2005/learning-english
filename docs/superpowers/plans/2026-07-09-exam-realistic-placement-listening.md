# Exam-Realistic Placement Listening (IELTS 40q / TOEIC 100q) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Run at most ONE subagent at a time (user rule).**
>
> On execution, save a copy of this plan to `docs/superpowers/plans/2026-07-09-exam-realistic-placement-listening.md` (repo convention).

**Goal:** Replace the 10-question placement listening with a full exam-realistic listening test chosen by the user's goal — IELTS Listening (40 câu, 4 section, ~30 phút) for IELTS/CEFR users, TOEIC Listening (100 câu, 4 part, ~45 phút, có ảnh Part 1 thật) for TOEIC users.

**Architecture:** Add `TOEIC` to `GoalType` + a third GoalPicker tab; author two new listening content files (`placement_ielts.md`, `placement_toeic.md`) in the existing `content/listening` format; extend the parser for question images and label-only (audio-only) options; extend `generate_audio.py` with `[PAUSE:n]`; branch the placement page/scoring routes on `user.goalType` via a new `PlacementTest.toeicListeningSetId`; keep the existing scale-to-40 band pipeline and add a TOEIC 5–495 estimate on the result page.

**Tech stack:** Next.js 15, Prisma/Postgres, tsx seed scripts, edge-tts + pydub (Python), vitest.

## Context (why)

User request: "sửa phần audio ở phần listening trong kiểm tra đầu vào — giống 1 bài listening IELTS thiệt nếu người dùng chọn IELTS, hoặc TOEIC thiệt nếu chọn TOEIC; nội dung chuẩn hơn, tăng từ 10 câu lên giống đề thật nhất có thể." User decisions (đã hỏi): **full-length cả hai** (IELTS 40, TOEIC 100) và **TOEIC Part 1 dùng ảnh CC0 thật** (tự tìm/tải về `web/public/images/listening/`).

Verified facts:
- TOEIC **không tồn tại** trong app hôm nay: `enum GoalType { IELTS CEFR }`, GoalPicker 2 tab, zod union 2 literal. Grep "toeic" trong web/ = 0 kết quả.
- Scoring KHÔNG hardcode 10 câu: `scaleRawScore(raw, total)` (src/lib/band.ts, `STANDARD_BAND_TABLE_TOTAL = 40`) chiếu mọi độ dài về thang 40 rồi `placementBand` → `startLessonFor`. Đổi số câu không vỡ scoring.
- Content model đã hỗ trợ nhiều section/kind mỗi ListeningSet (parse-listening.ts ủy quyền parse-exercise.ts). Thiếu: image field, option text rỗng, pause trong audio, TOEIC goal/scoring.
- `PlacementWizard.tsx` hardcode "trả lời 10 câu hỏi" (~line 223) và nhận flat question list (không section header).

## Global Constraints

- Bilingual: VN headings/instructions framing, EN audio content & questions. Không dịch content có sẵn.
- Audio TTS generate LOCAL only, mp3 commit vào repo — regeneration never on deploy path.
- Answer key là nguồn đáp án duy nhất; variants phân cách bằng `/`.
- Work trực tiếp trên `main`; commit mỗi task; `npx vitest run` pass trước mỗi commit (chạy qua `npm test` để load `.env.local`).
- TOEIC conversion table là ƯỚC TÍNH (ETS không công bố) — ghi rõ trong UI + comment.
- Tối đa 1 subagent chạy đồng thời.

---

### Task 1: Schema — TOEIC goal, Question.imageUrl, toeicListeningSetId, toeicListeningScore

**Files:**
- Modify: `web/prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev --name toeic_placement_listening`

**Interfaces:**
- Produces: `GoalType.TOEIC`; `Question.imageUrl String?`; `PlacementTest.toeicListeningSetId String?` (bare FK, cùng convention `listeningSetId`); `PlacementAttempt.toeicListeningScore Int?`.

- [ ] **Step 1: Edit schema** — thêm `TOEIC` vào `enum GoalType`; thêm vào `model Question`: `imageUrl String? // TOEIC Part 1 photograph, path under /public`; vào `model PlacementTest`: `toeicListeningSetId String? // TOEIC placement listening (bare FK like listeningSetId)`; vào `model PlacementAttempt`: `toeicListeningScore Int? // 5–495 estimate, TOEIC-goal users only`.
- [ ] **Step 2: Migrate + generate** — `cd web && npx prisma migrate dev --name toeic_placement_listening && npx prisma generate`. Expected: migration applies (additive-only: 1 enum value + 3 nullable columns, an toàn với DB có data).
- [ ] **Step 3: `npm test`** — Expected: 198 tests pass (không có test schema riêng).
- [ ] **Step 4: Commit** — `feat(schema): TOEIC goal type, Question.imageUrl, TOEIC placement listening link`

---

### Task 2: TOEIC goal UI + API

**Files:**
- Modify: `web/src/components/GoalPicker.tsx`, `web/src/app/api/onboarding/path/route.ts`, `web/src/components/SettingsGoalForm.tsx`; grep-check `goalType` displays in `web/src/app/(app)/{dashboard/page.tsx,settings/page.tsx,layout.tsx}` và thêm case TOEIC nếu có switch hiển thị.

**Interfaces:**
- Produces: `export const TOEIC_SCORES = ["500","600","700","800","900"] as const;` và `GoalTab = "IELTS" | "CEFR" | "TOEIC"` từ GoalPicker; API chấp nhận `{goalType:"TOEIC", goalValue:"500".."900"}`.

- [ ] **Step 1: GoalPicker** — thêm `TOEIC_SCORES`, tab thứ 3 `Mục tiêu TOEIC` (TabsTrigger value="TOEIC"), TabsContent chip điểm theo đúng grid pattern của IELTS bands, đánh dấu `"700"` là `Phổ biến`.
- [ ] **Step 2: API zod** — thêm vào discriminatedUnion: `z.object({ goalType: z.literal("TOEIC"), goalValue: z.enum(["500","600","700","800","900"]) })`.
- [ ] **Step 3: SettingsGoalForm + displays** — cập nhật type `"IELTS" | "CEFR"` hardcode nếu có; hiển thị goal dạng `TOEIC 700`.
- [ ] **Step 4: `npm test` + commit** — `feat(goal): TOEIC goal option in picker, API validation, and displays`

---

### Task 3: TOEIC listening conversion table (TDD)

**Files:**
- Create: `web/src/lib/toeic.ts`, `web/src/lib/toeic.test.ts`

**Interfaces:**
- Produces: `export function rawToToeicListening(raw: number): number` — clamp raw 0–100, trả 5–495 theo bảng `{min, score}[]` (cùng shape triết lý `BandTableRow` trong `src/lib/band.ts`); comment nguồn: bảng quy đổi prep-book phổ biến, là ước tính.

- [ ] **Step 1: Viết test fail trước** (pattern `band.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { rawToToeicListening } from "./toeic";

describe("rawToToeicListening", () => {
  it("floors at 5 and caps at 495", () => {
    expect(rawToToeicListening(0)).toBe(5);
    expect(rawToToeicListening(100)).toBe(495);
  });
  it("maps mid-range raw scores to published-style estimates", () => {
    expect(rawToToeicListening(50)).toBe(255);
    expect(rawToToeicListening(75)).toBe(385);
  });
  it("clamps out-of-range input", () => {
    expect(rawToToeicListening(-3)).toBe(5);
    expect(rawToToeicListening(120)).toBe(495);
  });
});
```

- [ ] **Step 2: Run** `npm test -- src/lib/toeic.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** bảng đầy đủ 0–100 (bước 5 raw hoặc row-per-min), pure function, không I/O; chỉnh bảng sao cho 3 giá trị test ở trên đúng.
- [ ] **Step 4: Run test pass + commit** — `feat(toeic): raw→TOEIC listening (5–495) conversion table with tests`

---

### Task 4: Parser — question images, empty-text options, PAUSE stripping (TDD)

**Files:**
- Modify: `web/scripts/seed/parse-exercise.ts`, `web/scripts/seed/parse-listening.ts`
- Test: `web/scripts/seed/parse-exercise.test.ts`, `web/scripts/seed/parse-listening.test.ts`

**Syntax quyết định:**
- Image: dòng markdown `![](/images/listening/toeic_p1_q1.jpg)` đứng riêng trong body câu hỏi (trước options) → extract vào `imageUrl`, strip khỏi `prompt`. Regex: `^!\[[^\]]*\]\(([^)]+)\)$`.
- Audio-only options: `- A)` không có text — nới regex option text từ `(.+)` thành `(.*)`; `hasOptions`/`inferKind` vẫn phải nhận là MULTIPLE_CHOICE; variant chỉ là label (`["A"]`).
- `parse-listening.ts`: strip các dòng `[PAUSE:n]` khỏi `transcriptMd` lưu DB.

**Interfaces:**
- Produces: parsed question type có thêm `imageUrl: string | null`.

- [ ] **Step 1: Viết test fail** — thêm vào `parse-exercise.test.ts`:

```ts
it("extracts an image line into imageUrl and strips it from the prompt", () => {
  const md = `## SECTION A: MULTIPLE CHOICE\n1. Chọn câu mô tả đúng nhất bức ảnh.\n![](/images/listening/toeic_p1_q1.jpg)\n- A)\n- B)\n- C)\n- D)\n\n## ANSWER KEY (ĐÁP ÁN)\n### Section A:\n1. B`;
  const parsed = parseExercise(md);
  const q = parsed.sections[0].questions[0];
  expect(q.imageUrl).toBe("/images/listening/toeic_p1_q1.jpg");
  expect(q.prompt).not.toContain("![");
});

it("parses options with empty text (TOEIC Part 2 style A/B/C)", () => {
  // expect options [{label:"A",text:""},{label:"B",text:""},{label:"C",text:""}], kind MULTIPLE_CHOICE
});
```

  và vào `parse-listening.test.ts`: test `[PAUSE:20]` lines không xuất hiện trong `transcriptMd`.
- [ ] **Step 2: Run fail** — `npm test -- scripts/seed/parse-exercise.test.ts scripts/seed/parse-listening.test.ts`.
- [ ] **Step 3: Implement** trong `buildPrompt` (parse-exercise.ts ~line 443-455) + kiểm `variantsMultipleChoice` (~480-490) không vỡ khi text rỗng (label-only variant).
- [ ] **Step 4: Run pass + commit** — `feat(parse): question imageUrl extraction, empty-text MCQ options, PAUSE-line stripping`

---

### Task 5: Persist + render images và label-only options

**Files:**
- Modify: `web/scripts/seed/ingest.ts` (ghi `imageUrl` vào `Question.create` cho listening), `web/src/components/runner/QuestionCard.tsx` (`SafeQuestion` + render), `web/src/app/onboarding/placement/page.tsx`, và mapping SafeQuestion trong `web/src/components/ListeningRunner.tsx` / `ListeningSetView.tsx` nếu có.

**Interfaces:**
- Consumes: parser `imageUrl` (Task 4), schema `Question.imageUrl` (Task 1).
- Produces: `SafeQuestion.imageUrl?: string | null`; QuestionCard render ảnh + nút option label-only khi `opt.text === ""`.

- [ ] **Step 1: SafeQuestion + QuestionCard** — render trước prompt:

```tsx
{question.imageUrl && (
  <img src={question.imageUrl} alt={`Ảnh cho câu ${question.number}`}
       className="mb-3 w-full max-w-md rounded-xl border border-border" />
)}
```

  Option button: khi `opt.text === ""` chỉ render chip label (giữ `onChangeJoined(opt.label)` nguyên).
- [ ] **Step 2: ingest.ts + placement page mapping** — thêm `imageUrl` vào create + cả 2 SafeQuestion mapping.
- [ ] **Step 3: `npm test` + commit** — `feat(ui): render question images and audio-only A/B/C options in QuestionCard`

---

### Task 6: `[PAUSE:n]` directive trong generate_audio.py

**Files:**
- Modify: `web/scripts/tts/generate_audio.py`

- [ ] **Step 1: Parse directive** — trong vòng parse transcript, trước `LINE_RE`:

```python
PAUSE_RE = re.compile(r"^\[PAUSE:(\d+(?:\.\d+)?)\]$")
m = PAUSE_RE.match(line)
if m:
    lines.append(("__PAUSE__", m.group(1)))
    continue
```

  Trong synthesis loop: speaker `__PAUSE__` → `AudioSegment.silent(duration=int(float(text) * 1000))`, bỏ 400ms inter-turn silence cho entry đó.
- [ ] **Step 2: `--dry-run` flag** — chỉ parse và in kế hoạch (speaker, voice, giây pause) — đây là "test" cho Python (không có harness).
- [ ] **Step 3: Retry** — bọc synth mỗi line với retry 3 lần (edge-tts network flake, quan trọng cho bài 45 phút).
- [ ] **Step 4: Verify** — `python scripts/tts/generate_audio.py content/listening/placement_01.md --dry-run` in được plan. Commit: `feat(tts): [PAUSE:n] silence directive, --dry-run, per-line retry`

---

### Task 7: Author `web/content/listening/placement_ielts.md` (40 câu)

Theo đúng convention `placement_01.md`: front matter (`slug: placement_ielts`, `title`, `kind: PLACEMENT`, `voices`), `## TRANSCRIPT`, `## QUESTIONS` với các `## SECTION X:`, `## ANSWER KEY (ĐÁP ÁN)` với `### Section X:`. VN headings/instructions, EN nội dung nghe + câu hỏi.

**Cấu trúc bắt buộc:**

| Section | Kind | Câu | Nội dung |
|---|---|---|---|
| SECTION 1 | FILL_BLANK (form completion `______`) | 1–10 | hội thoại đời sống (đặt chỗ/đăng ký), 2 speaker A/B |
| SECTION 2 | MULTIPLE_CHOICE (A–C) + FILL_BLANK notes | 11–20 | độc thoại (giới thiệu cơ sở/tour), speaker C |
| SECTION 3 | MULTIPLE_CHOICE (A–C) | 21–30 | thảo luận học thuật, tutor + 2 sinh viên |
| SECTION 4 | FILL_BLANK sentence completion | 31–40 | bài giảng học thuật, 1 speaker |

- Voices edge-tts riêng cho từng speaker + `NARRATOR` đọc intro section ("Section 2. You will hear...").
- `[PAUSE:20]` trước mỗi section (thời gian đọc câu hỏi), `[PAUSE:15]` sau (kiểm tra đáp án). Target ~28–32 phút.
- FILL_BLANK answers ≤ 3 từ; variants bằng `/`. Đủ 40 đáp án.

- [ ] **Step 1: Author transcript + questions + answer key** (đầy đủ, không placeholder).
- [ ] **Step 2: QA** — `npm test -- scripts/seed/parse-listening.test.ts`; kiểm đếm bằng tsx one-liner: parse file, assert 4 sections & 40 questions & 40 answers (khuyến nghị viết `web/scripts/seed/check-listening.ts <file> <expectedCount>` dùng lại cho Task 8); `python scripts/tts/generate_audio.py content/listening/placement_ielts.md --dry-run`.
- [ ] **Step 3: Commit** — `content: IELTS placement listening (4 sections, 40 questions)`

---

### Task 8: Author `web/content/listening/placement_toeic.md` (100 câu)

Cùng convention file. Chia 4 sub-pass (mỗi part một lượt), verify count sau mỗi part.

| Section | Kind | Câu | Ghi chú |
|---|---|---|---|
| SECTION 1 (Part 1 — Photographs) | MCQ A–D **options rỗng** + `![](/images/listening/toeic_p1_qN.jpg)`; prompt "Chọn câu mô tả đúng nhất bức ảnh." | 1–6 | Transcript: narrator "Number one. Look at the picture...", 1 voice đọc "(A)...(B)...(C)...(D)" từng dòng; `[PAUSE:5]` giữa các câu |
| SECTION 2 (Part 2 — Question–Response) | MCQ A–C **options rỗng**; prompt "Chọn câu trả lời phù hợp nhất." | 7–31 (25) | 1 speaker hỏi, speaker khác đọc (A)/(B)/(C); `[PAUSE:5]` mỗi câu |
| SECTION 3 (Part 3 — Conversations) | MCQ A–D **có text** | 32–70 (39 = 13 hội thoại × 3) | 2–3 speaker; narrator giới thiệu; `[PAUSE:8]`/cụm 3 câu |
| SECTION 4 (Part 4 — Talks) | MCQ A–D **có text** | 71–100 (30 = 10 bài nói × 3) | 1 speaker mỗi talk |

- Voices trộn US/UK/AU (`en-US-GuyNeural`, `en-US-JennyNeural`, `en-GB-SoniaNeural`, `en-AU-NatashaNeural`) + NARRATOR. Target ~40–45 phút.
- Part 1–2: đáp án chỉ được NÓI trong transcript, KHÔNG in trong body (chỉ `- A)` / `- B)` / `- C)` (/`- D)`) label-only — Task 4).
- Answer key `### Section 1:`…`### Section 4:` đủ 100 đáp án.

- [ ] **Step 1–4: Author từng part**, sau mỗi part chạy check-listening count (6/25/39/30).
- [ ] **Step 5: QA tổng** — parse test + `--dry-run`. Commit: `content: TOEIC placement listening (4 parts, 100 questions)`

---

### Task 9: Ảnh CC0 cho TOEIC Part 1

**Files:**
- Create: `web/public/images/listening/toeic_p1_q1.jpg` … `toeic_p1_q6.jpg`, `web/public/images/listening/NOTICE.md`

- [ ] **Step 1: Tải 6 ảnh CC0/public-domain** (Openverse lọc CC0 / Wikimedia Commons) cảnh TOEIC kinh điển: họp văn phòng, người dùng máy tính, nhà hàng/café, đường phố, kho hàng/công nhân, sân bay/ga tàu. Resize ≤1024px, ≤~200KB (`convert`/`ffmpeg`).
- [ ] **Step 2: NOTICE.md** — từng file: source URL, tác giả, license.
- [ ] **Step 3: Khớp nội dung** — ảnh phải khớp 4 statement đã author ở Task 8 Section 1 (điều chỉnh transcript nếu cần). Commit: `content: CC0 Part 1 photographs with license NOTICE`

---

### Task 10: Generate audio + retire placement_01

- [ ] **Step 1: Generate** (local, venv `web/scripts/tts/.venv`):

```bash
python scripts/tts/generate_audio.py content/listening/placement_ielts.md
python scripts/tts/generate_audio.py content/listening/placement_toeic.md
```

  Expected: `public/audio/listening/placement_ielts.mp3` (~10MB), `placement_toeic.mp3` (~16MB). Nghe spot-check: pause có, narrator intro có, không thiếu voice.
- [ ] **Step 2: Retire placement_01** — đổi front matter `kind: PLACEMENT` → `kind: PRACTICE` trong `content/listening/placement_01.md` (giữ làm bài luyện, không xóa gì).
- [ ] **Step 3: Kiểm durationSec** — xem ingest.ts lấy duration từ đâu (ffprobe warn nếu thiếu — chấp nhận, hoặc set front matter nếu được hỗ trợ).
- [ ] **Step 4: Commit** — `content: generated placement audio; retire placement_01 to practice`

---

### Task 11: Goal-based branching — seed, page, scoring routes

**Files:**
- Modify: `web/scripts/seed/seed-placement.ts`, `web/src/app/onboarding/placement/page.tsx`, `web/src/app/api/placement/submit-section/route.ts`, `web/src/app/api/placement/complete/route.ts`, `web/src/app/onboarding/placement/result/page.tsx`
- Create: `web/src/lib/placement-listening.ts`

**Interfaces:**
- Produces:

```ts
// src/lib/placement-listening.ts
import type { GoalType, PlacementTest } from "@prisma/client";
export function placementListeningSetId(test: PlacementTest, goalType: GoalType | null): string | null {
  return goalType === "TOEIC" ? (test.toeicListeningSetId ?? test.listeningSetId) : test.listeningSetId;
}
```

  (fallback về IELTS set nếu TOEIC chưa seed — degrade, không vỡ.)

- [ ] **Step 1: seed-placement.ts** — `LISTENING_SLUG = "placement_ielts"`, thêm `TOEIC_LISTENING_SLUG = "placement_toeic"`; resolve cả hai, warn nếu thiếu, set cả `listeningSetId` + `toeicListeningSetId`. Reading/writing/bandTable giữ nguyên.
- [ ] **Step 2: placement/page.tsx** — dùng helper với `user.goalType`; đổi payload listening từ flat questions sang **sections** (label/title/instructions/questions — cùng shape `readingSections`) + `imageUrl` + `durationSec`.
- [ ] **Step 3: submit-section + complete routes** — thay mọi chỗ dùng `test.listeningSetId` cho totals/grading bằng helper (user đã load sẵn trong cả 2 route).
- [ ] **Step 4: complete/route.ts** — khi `user.goalType === "TOEIC"`: `toeicListeningScore = rawToToeicListening(listeningScore)` (raw /100, KHÔNG scale), persist vào `PlacementAttempt`. Band pipeline giữ nguyên (vẫn scaleRawScore → bandTable → startLessonFor).
- [ ] **Step 5: result/page.tsx** — nếu `attempt.toeicListeningScore != null`: render `Ước tính TOEIC Listening: {score}/495` + caption "ước tính, không phải điểm chính thức".
- [ ] **Step 6: `npm test` + commit** — `feat(placement): goal-based listening set selection and TOEIC score estimate`

---

### Task 12: Wizard — sectioned listening UI + dynamic copy

**Files:**
- Modify: `web/src/components/PlacementWizard.tsx`

**Interfaces:**
- Consumes: `listening: { audioUrl: string; durationSec: number | null; sections: {label,title,instructions,questions: SafeQuestion[]}[] } | null` (Task 11 Step 2).

- [ ] **Step 1:** đổi prop shape; derive `const listeningQuestions = sections.flatMap(s => s.questions)` để giữ nguyên submit logic (rawScore/results/answer map).
- [ ] **Step 2:** render section header (label/title/instructions) trên mỗi nhóm câu — mirror cách render reading sections.
- [ ] **Step 3:** thay hardcode `"trả lời 10 câu hỏi"` (~line 223) bằng `trả lời {listeningQuestions.length} câu hỏi (~{Math.round((durationSec ?? 0)/60)} phút audio)` (ẩn phút nếu null). Một AudioPlayer duy nhất giữ nguyên, không timer.
- [ ] **Step 4: `npm test` + commit** — `feat(wizard): sectioned listening rendering with dynamic question count and duration`

---

### Task 13: Final verification (end-to-end)

- [ ] **Step 1:** `npm test` — toàn bộ suite pass (kể cả toeic/parse tests mới).
- [ ] **Step 2:** `npx prisma migrate deploy` + `npm run seed` + `npm run seed:placement` (hoặc trong docker: `docker compose exec web npx tsx scripts/seed/...`) — log in ra cả 2 listening set id, question counts 40/100.
- [ ] **Step 3:** `npm run build` pass (Next 15 typecheck).
- [ ] **Step 4:** Docker rebuild + up; `curl -sI localhost:3000/audio/listening/placement_toeic.mp3` → 200 (~16MB), tương tự `placement_ielts.mp3` và 1 ảnh `toeic_p1_q1.jpg`.
- [ ] **Step 5:** Browser (Playwright MCP):
  - Flow TOEIC: user mới → goal TOEIC 700 → placement hiện Part 1 có ảnh, nút A/B/C(/D) label-only, 100 câu 4 section → submit → result hiện band + dòng TOEIC estimate.
  - Flow IELTS: user mới → goal IELTS 6.5 → 40 câu 4 section → result hiện band, KHÔNG có dòng TOEIC.
- [ ] **Step 6:** Nghe spot-check 2 file mp3.

---

## Risks

- **edge-tts synthesis dài** (TOEIC ~300–500 dòng, 20–40 phút chạy, network flake) → mitigated: `--dry-run` trước, retry 3 lần/line (Task 6).
- **mp3 ~16MB commit vào git** — đúng convention hiện tại nhưng lớn; 48kbps mono giữ bounded.
- **Enum migration trên DB có data** — `ALTER TYPE ADD VALUE` additive, an toàn; user cũ giữ IELTS/CEFR, mặc định nhận đề IELTS.
- **Đổi LISTENING_SLUG** yêu cầu rerun seed-placement, nếu không FK trỏ set cũ — Task 13 Step 2 cover.
- **Bảng quy đổi TOEIC là ước tính** — label rõ trong UI.
- **100 QuestionCard render một lúc** — chấp nhận theo pattern QuestionBatch hiện có; virtualization là follow-up.
