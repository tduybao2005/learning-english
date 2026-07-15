# Sửa 4 lỗi: placement gating, back-button, wrong-answer feedback, listening retake

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans để thực thi từng task. Steps dùng checkbox (`- [ ]`).

**Goal:** Sửa 4 lỗi độc lập trong app `web/`: (1) placement tin điểm client gửi + để sót row UNLOCKED khi xếp lại band làm khoá nhầm bài học GĐ1; (2) nút "← Câu trước" chết khi vào lại bài đang làm dở; (3) trả lời sai không hiện đáp án; (4) phần Nghe của bài kiểm tra đầu vào biến mất khi làm lại.

**Architecture:** Next.js 15 App Router (RSC + route handlers), Prisma/Postgres, NextAuth v5 (JWT), Vitest. Grading luôn ở server (`matchAnswer`). Trạng thái bài học lưu trong `LessonProgress` (không có gate theo phase — chỉ per-lesson).

**Tech Stack:** TypeScript, React, Prisma, Zod, Vitest, Tailwind.

## Global Constraints

- Bilingual: heading/label tiếng Việt, giữ nguyên nội dung tiếng Anh. Không dịch nội dung có sẵn.
- Grading không bao giờ lộ answer key ra client trừ khi đã được phép hiển thị.
- Work trực tiếp trên `main`. Chạy tối đa 1 subagent tại một thời điểm.
- Tests co-located cạnh source. Chạy: `cd web && npm test`.
- Placement: **vẫn cho nhảy band** — thi thật band cao vẫn nhảy thẳng GĐ phù hợp (`startLessonFor` giữ nguyên ngưỡng hiện tại). Chỉ bịt đường gửi điểm giả và sửa việc để sót row.

---

## Bối cảnh (vì sao sửa)

Xác nhận từ source + DB thật (`t.dbao.ron@gmail.com`):

1. **Placement gating (2 lỗi chồng nhau):**
   - **Lỗ hổng tin client:** `POST /api/placement/complete` (`web/src/app/api/placement/complete/route.ts`) nhận `readingScore`/`listeningScore` từ request body, chỉ clamp theo tổng câu, **không hề chấm lại**. `/api/placement/submit-section` chấm đúng server-side nhưng stateless (không ghi gì). → user có session hợp lệ POST thẳng điểm max → band max → nhảy GĐ. (Đây là thứ đã xảy ra khi pentest.)
   - **Để sót row UNLOCKED:** `assignStartPoint` (`web/src/lib/progress.ts:113`) chỉ `deleteMany({status:"SKIPPED"})`, **không dọn row `UNLOCKED` cũ** nằm sau điểm bắt đầu mới. Chuỗi tái hiện: placement band 4.5 → GĐ1 = 13 row SKIPPED + GĐ2 bài 1 = UNLOCKED. Placement lại band 0 → xoá sạch SKIPPED, `beforeLessons` rỗng nên không ghi lại → GĐ1 mất hết row (chỉ bài 1 mở nhờ fallback "bài đầu tiên luôn UNLOCKED"), **GĐ2 bài 1 vẫn UNLOCKED**. Đúng như ảnh dashboard.

2. **Back-button chết:** `ExerciseRunner.tsx` — mảng `past` (client-only) chỉ được nạp qua `handleContinue()` trong phiên hiện tại, khởi tạo `[]` mỗi lần mount, **không bao giờ hydrate từ server**. Nút disabled khi `past.length === 0`. User đã làm 46/47 câu rồi vào lại → resume tại index 45 với `past=[]` → nút xám, không bấm được.

3. **Sai không hiện đáp án:** `web/src/app/api/attempts/[id]/answers/route.ts` chỉ trả `correctAnswer` khi `matchResult.correct` (dòng ~183). Sai → không có đáp án, buộc nhập lại mãi. `keyNote` thì luôn trả (kể cả ERROR_CORRECTION mà keyNote = câu đúng hoàn chỉnh).

4. **Listening retake mất:** DB thật `PlacementTest.default` có `listeningSetId = NULL` và `toeicListeningSetId = NULL`. FK là `onDelete: SetNull`; `ingest.ts` (`npm run seed`) delete+create lại mọi ListeningSet với id mới, làm null FK; chỉ `seed:placement` re-link. Sau một lần `npm run seed`, page nhận `listening=null` → wizard render "Phần nghe chưa sẵn sàng", không audio, không câu hỏi.

**Ghi chú hệ thống tương lai (chỉ note, không code trong plan này):** Sau này AI sẽ chấm chi tiết bài placement để tìm chỗ hổng kiến thức và sinh roadmap riêng cho người band ≥ 4.0, đi tới bài giảng GĐ cao (UI sẽ làm lại). Dashboard hiện tại chỉ dành cho người học lại từ đầu / band thấp. Người band < 4.0 (hoặc tương ứng TOEIC) bắt buộc học lại từ bài 1. Task 5 chỉ ghi các thay đổi cấu trúc này vào file md, không đụng UI.

---

## Task 1: `assignStartPoint` dọn cả row UNLOCKED/COMPLETED-nhầm sau điểm bắt đầu mới

**Vấn đề:** khi xếp lại điểm bắt đầu về sớm hơn, các row `UNLOCKED` (và bất kỳ row nào ở phase/lesson **sau** start mới do lần placement trước tạo) bị bỏ lại → dashboard khoá nhầm/ mở nhầm.

**Quyết định thiết kế:** `assignStartPoint` là nguồn chân lý duy nhất về "điểm bắt đầu". Sau khi chạy, trạng thái đúng phải là: mọi lesson trước start = SKIPPED (trừ đã COMPLETED thật), start = UNLOCKED (trừ đã COMPLETED), và **mọi lesson sau start không được có row do placement để lại** — trừ row COMPLETED (tiến độ học thật, không được xoá). Cách an toàn: xoá các row `SKIPPED` **và** `UNLOCKED` của user rồi dựng lại; giữ nguyên `COMPLETED`.

**Files:**
- Modify: `web/src/lib/progress.ts` (hàm `assignStartPoint`, ~dòng 129: câu `deleteMany`)
- Test: `web/src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `assignStartPoint(client, userId, startLessonId)` (chữ ký không đổi).
- Produces: hành vi mới — không còn để sót row UNLOCKED sau start.

- [ ] **Step 1: Viết test thất bại** — thêm vào `web/src/lib/progress.test.ts`:

```ts
it("clears a stale UNLOCKED row that sits AFTER a newly-earlier start point", async () => {
  // Giả lập: lần placement trước mở GĐ2 bài 1 (UNLOCKED) + skip GĐ1.
  // Lần này xếp lại về lesson đầu tiên toàn cục.
  const userId = await makeUser();
  const [l1, /* ... */] = await lessonsInOrder();
  const gd2l1 = await lessonBySlug("lesson_01_past_continuous"); // phase_2
  await db.lessonProgress.create({ data: { userId, lessonId: gd2l1.id, status: "UNLOCKED" } });

  await assignStartPoint(db, userId, l1.id);

  const rows = await db.lessonProgress.findMany({ where: { userId } });
  // Không được còn row UNLOCKED nào ở GĐ2:
  expect(rows.find((r) => r.lessonId === gd2l1.id)).toBeUndefined();
  // Lesson đầu tiên = UNLOCKED:
  expect(rows.find((r) => r.lessonId === l1.id)?.status).toBe("UNLOCKED");
});

it("never downgrades a COMPLETED lesson that sits after the start point", async () => {
  const userId = await makeUser();
  const [l1] = await lessonsInOrder();
  const gd2l1 = await lessonBySlug("lesson_01_past_continuous");
  await db.lessonProgress.create({ data: { userId, lessonId: gd2l1.id, status: "COMPLETED", completedAt: new Date() } });

  await assignStartPoint(db, userId, l1.id);

  const row = await db.lessonProgress.findFirst({ where: { userId, lessonId: gd2l1.id } });
  expect(row?.status).toBe("COMPLETED"); // giữ nguyên tiến độ thật
});
```

(Dùng lại helper sẵn có trong file test; nếu chưa có `lessonBySlug`, viết inline bằng `db.lesson.findFirst({ where: { slug } })`.)

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd web && npm test -- progress.test`
Expected: FAIL (row UNLOCKED của GĐ2 còn sót).

- [ ] **Step 3: Sửa `assignStartPoint`** — đổi dòng dọn dẹp trong `web/src/lib/progress.ts`:

Từ:
```ts
await client.lessonProgress.deleteMany({ where: { userId, status: "SKIPPED" } });
```
Thành:
```ts
// Xoá mọi row do một lần xếp-điểm trước để lại (SKIPPED + UNLOCKED) để
// điểm-bắt-đầu mới là nguồn chân lý duy nhất. COMPLETED là tiến độ học
// thật — không bao giờ xoá; các nhánh upsert bên dưới đã tôn trọng nó.
await client.lessonProgress.deleteMany({
  where: { userId, status: { in: ["SKIPPED", "UNLOCKED"] } },
});
```

Cập nhật docstring ngay trên hàm để phản ánh: "clears this user's existing SKIPPED **and UNLOCKED** rows first".

- [ ] **Step 4: Chạy test — phải PASS**

Run: `cd web && npm test -- progress.test`
Expected: PASS (cả 2 test mới + test cũ).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/progress.ts web/src/lib/progress.test.ts
git commit -m "fix(progress): clear stale UNLOCKED rows when reassigning start point

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `/api/placement/complete` tự chấm server-side, bỏ điểm client gửi

**Quyết định thiết kế:** ngừng tin `readingScore`/`listeningScore` từ body. Client gửi map **câu trả lời dạng text** cho cả 2 section; server tự chấm bằng `matchAnswer` (đúng như `submit-section`) trên đúng bộ câu hỏi của test → tính điểm. Thi thật band cao vẫn nhảy GĐ (dùng chung `startLessonFor`). Kẻ tấn công không biết answer key server-side nên không thể gửi điểm giả.

**Files:**
- Modify: `web/src/app/api/placement/complete/route.ts` (schema + phần tính điểm)
- Modify: `web/src/components/PlacementWizard.tsx` (`handleFinishAll` gửi answer text maps thay vì score)
- Test: tạo `web/src/app/api/placement/complete/route.test.ts` nếu chưa có (kiểm tra hàm chấm tách riêng — xem Step 1)

**Interfaces:**
- Produces: `POST /api/placement/complete` body mới:
  ```ts
  { listeningAnswers: Record<string,string>, readingAnswers: Record<string,string>, writingText: string }
  ```
  (`answers` audit map cũ bị bỏ; server tự dựng lại từ kết quả chấm.)

- [ ] **Step 1: Tách hàm chấm thuần + viết test thất bại**

Tạo `web/src/lib/placement-grading.ts`:
```ts
import type { QuestionKind } from "@/lib/grading/match";
import { matchAnswer } from "@/lib/grading/match";

export interface GradableQuestion {
  id: string;
  kind: QuestionKind;
  isOpenEnded: boolean;
  variants: { normalized: string }[];
}

/** Chấm một section: chỉ tính những câu thuộc `questions` (bỏ id lạ),
 * trả về rawScore + audit map. Answer key không rời server. */
export function gradePlacementSection(
  questions: GradableQuestion[],
  answers: Record<string, string>,
): { rawScore: number; results: Record<string, { text: string; isCorrect: boolean }> } {
  let rawScore = 0;
  const results: Record<string, { text: string; isCorrect: boolean }> = {};
  for (const q of questions) {
    const text = answers[q.id] ?? "";
    const r = matchAnswer(text, { kind: q.kind, isOpenEnded: q.isOpenEnded, variants: q.variants });
    if (r.correct) rawScore++;
    results[q.id] = { text, isCorrect: r.correct };
  }
  return { rawScore, results };
}
```

Tạo `web/src/lib/placement-grading.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { gradePlacementSection } from "./placement-grading";

const q = (id: string, normalized: string) => ({
  id, kind: "FILL_BLANK" as const, isOpenEnded: false, variants: [{ normalized }],
});

describe("gradePlacementSection", () => {
  it("scores only listed questions and ignores unknown ids", () => {
    const out = gradePlacementSection([q("a", "cat"), q("b", "dog")], { a: "cat", b: "wrong", z: "cat" });
    expect(out.rawScore).toBe(1);
    expect(out.results.z).toBeUndefined();
    expect(out.results.b.isCorrect).toBe(false);
  });

  it("treats a missing answer as blank/incorrect", () => {
    const out = gradePlacementSection([q("a", "cat")], {});
    expect(out.rawScore).toBe(0);
    expect(out.results.a).toEqual({ text: "", isCorrect: false });
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL** (module chưa tồn tại)

Run: `cd web && npm test -- placement-grading`
Expected: FAIL "Cannot find module './placement-grading'".

- [ ] **Step 3: (Module đã viết ở Step 1) — chạy lại, phải PASS**

Run: `cd web && npm test -- placement-grading`
Expected: PASS.

- [ ] **Step 4: Đổi route `complete` dùng hàm chấm, bỏ điểm client**

Trong `web/src/app/api/placement/complete/route.ts`, đổi `bodySchema`:
```ts
const bodySchema = z.object({
  listeningAnswers: z.record(z.string(), z.string()).default({}),
  readingAnswers: z.record(z.string(), z.string()).default({}),
  writingText: z.string(),
});
```

Sau khi resolve `test` và `listeningSetId`, thay khối lấy `readingScore`/`listeningScore` bằng: nạp câu hỏi thật của mỗi section rồi chấm.
```ts
import { gradePlacementSection, type GradableQuestion } from "@/lib/placement-grading";
import type { QuestionKind } from "@/lib/grading/match";

const readingQs = await db.question.findMany({
  where: { section: { placementTestId: test.id } },
  include: { section: true, variants: true },
});
const listeningQs = listeningSetId
  ? await db.question.findMany({
      where: { section: { listeningSetId } },
      include: { section: true, variants: true },
    })
  : [];

const toGradable = (q: (typeof readingQs)[number]): GradableQuestion => ({
  id: q.id,
  kind: q.section.kind as QuestionKind,
  isOpenEnded: q.isOpenEnded,
  variants: q.variants.map((v) => ({ normalized: v.normalized })),
});

const reading = gradePlacementSection(readingQs.map(toGradable), parsed.data.readingAnswers);
const listening = gradePlacementSection(listeningQs.map(toGradable), parsed.data.listeningAnswers);
const readingScore = reading.rawScore;
const listeningScore = listening.rawScore;
const readingTotal = readingQs.length;
const listeningTotal = listeningQs.length;
const answers = { ...listening.results, ...reading.results }; // audit map, server-built
```

Giữ nguyên phần scale + `rawToBand` + `placementBand` + `startLessonFor` + `assignStartPoint` phía dưới (band-jump giữ nguyên). Lưu `answers` (đã build server) vào `PlacementAttempt.answers`. Xoá mọi tham chiếu `parsed.data.readingScore`/`listeningScore`/`parsed.data.answers`.

- [ ] **Step 5: Cập nhật `PlacementWizard.handleFinishAll` gửi answer maps**

Trong `web/src/components/PlacementWizard.tsx`, body của fetch `/api/placement/complete`:
```ts
body: JSON.stringify({
  listeningAnswers,
  readingAnswers,
  writingText,
}),
```
(dùng thẳng 2 state `listeningAnswers`/`readingAnswers` đã có — dòng 136–137. Có thể bỏ `combinedResults` nếu không còn dùng nơi khác; kiểm tra bằng grep trước khi xoá.)

- [ ] **Step 6: Chạy toàn bộ test + lint**

Run: `cd web && npm test -- placement && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/placement-grading.ts web/src/lib/placement-grading.test.ts web/src/app/api/placement/complete/route.ts web/src/components/PlacementWizard.tsx
git commit -m "fix(placement): grade sections server-side, never trust client scores

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Hydrate lịch sử để nút "← Câu trước" hoạt động khi vào lại bài dở

**Quyết định thiết kế:** RSC page đã có `attempt` + toàn bộ questions. Nạp sẵn `AttemptAnswer` của attempt hiện tại và truyền xuống làm `initialPast` để `past` không rỗng khi resume. Chỉ hiển thị **read-only** (đúng tinh thần commit e6b0857): các câu đã trả lời trước đó. Với câu chưa từng trả lời thì không đưa vào `past`.

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx` (nạp AttemptAnswer, truyền prop)
- Modify: `web/src/components/ExerciseRunner.tsx` (nhận `initialPast`, khởi tạo `past`)
- Test: `web/src/components/ExerciseReview.test.tsx`

**Interfaces:**
- Produces: `ExerciseRunner` nhận thêm prop optional `initialPast: PastAnswer[]`; `ExerciseRunnerSession` nhận và `useState(initialPast)`.

- [ ] **Step 1: Viết test thất bại** trong `web/src/components/ExerciseReview.test.tsx`:

```ts
it("enables '← Câu trước' immediately when resuming with prior answers", async () => {
  render(
    <ExerciseRunner
      exerciseId="ex1"
      attemptId="att1"
      initialQuestionNumber={3}
      questions={threeQuestions}
      nextLesson={null}
      backHref="/x"
      initialPast={[
        { index: 0, answerText: "a", correctAnswer: "a", keyNote: null },
        { index: 1, answerText: "b", correctAnswer: "b", keyNote: null },
      ]}
    />,
  );
  const prev = screen.getByRole("button", { name: /Câu trước/ });
  expect(prev).not.toBeDisabled();
  await userEvent.click(prev);
  expect(screen.getByText(/Xem lại — Câu 2\/3/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd web && npm test -- ExerciseReview`
Expected: FAIL (prop `initialPast` chưa tồn tại; nút disabled).

- [ ] **Step 3: Thêm prop `initialPast` vào `ExerciseRunner`**

Trong `web/src/components/ExerciseRunner.tsx`:
- Export type `PastAnswer` (bỏ `interface` private thành `export interface PastAnswer`).
- `ExerciseRunnerProps` thêm: `initialPast?: PastAnswer[];`
- `ExerciseRunner(...)` truyền `initialPast` xuống `ExerciseRunnerSession`.
- Trong `ExerciseRunnerSession`, đổi: `const [past, setPast] = useState<PastAnswer[]>(initialPast ?? []);` và thêm `initialPast` vào tham số.
- Nút "← Câu trước" giữ nguyên logic `disabled={past.length === 0}` — giờ đã có dữ liệu.

- [ ] **Step 4: Nạp AttemptAnswer trong RSC page**

Trong `web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx`, sau khi có `attempt` và `ordered`:
```ts
const answered = await db.attemptAnswer.findMany({
  where: { attemptId: attempt.id },
  select: { questionId: true, answerText: true },
});
const answeredByQid = new Map(answered.map((a) => [a.questionId, a.answerText]));
// past = các câu ĐỨNG TRƯỚC câu hiện tại (index < currentIndex) đã có câu trả lời.
const currentIndex = attempt.currentQuestionNumber - 1;
const initialPast = ordered
  .map((q, index) => ({ q, index }))
  .filter(({ q, index }) => index < currentIndex && answeredByQid.has(q.id))
  .map(({ q, index }) => ({
    index,
    answerText: answeredByQid.get(q.id) ?? "",
    // Đáp án đúng: chỉ hiện cho câu đã qua (read-only review) — an toàn vì
    // các câu này người học đã trả lời đúng để vượt qua.
    correctAnswer: q.answerRaw ?? null,
    keyNote: q.keyNote ?? null,
  }));
```
Kiểm tra `getOrderedQuestions` trả về `answerRaw`/`keyNote`; nếu chưa, thêm vào `select` của nó (`web/src/lib/exercises.ts`) — chỉ 2 trường này, không phải variants.
Truyền `initialPast={initialPast}` vào `<ExerciseRunner .../>`.

- [ ] **Step 5: Chạy test — phải PASS**

Run: `cd web && npm test -- ExerciseReview`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx" web/src/components/ExerciseRunner.tsx web/src/components/ExerciseReview.test.tsx web/src/lib/exercises.ts
git commit -m "fix(exercise): hydrate prior answers so back button works on resume

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Hiện đáp án khi trả lời sai + nút "Làm lại" / "Tiếp tục"

**Quyết định thiết kế (theo yêu cầu user):** ngay lần sai đầu tiên: hiện đáp án đúng + ghi nhớ/giải thích, thêm nút **"Làm lại"** (reset đúng câu đó để tự gõ lại rồi Kiểm tra) và **"Tiếp tục"** (sang câu sau, không cần làm lại). Chuẩn hoá luôn việc `keyNote` của ERROR_CORRECTION lộ đáp án — giờ hiển thị đáp án nhất quán một chỗ.

Server phải trả `correctAnswer` cả khi sai. Reducer thêm action `REDO_QUESTION` (reset về `answering`, xoá input/result nhưng giữ index).

**Files:**
- Modify: `web/src/app/api/attempts/[id]/answers/route.ts` (trả `correctAnswer` khi sai)
- Modify: `web/src/components/runner/reducer.ts` (action `REDO_QUESTION`)
- Modify: `web/src/components/ExerciseRunner.tsx` (UI hiện đáp án + 2 nút)
- Test: `web/src/components/runner/reducer.test.ts` (nếu có) + `web/src/components/ExerciseReview.test.tsx`

**Interfaces:**
- Produces: `AnswerResult.correctAnswer` set cả khi sai. Reducer thêm `{ type: "REDO_QUESTION" }` → về phase `answering`, `input:""`, `result:null`, `tries` giữ nguyên, `index` giữ nguyên.

- [ ] **Step 1: Test reducer thất bại** trong `web/src/components/runner/reducer.test.ts` (tạo nếu chưa có):

```ts
import { describe, it, expect } from "vitest";
import { runnerReducer, initRunnerState } from "./reducer";

describe("REDO_QUESTION", () => {
  it("resets an incorrect question back to answering without moving index", () => {
    let s = initRunnerState(["q1", "q2"], 0);
    s = runnerReducer(s, { type: "SET_INPUT", value: "wrong" });
    s = runnerReducer(s, { type: "SUBMIT" });
    s = runnerReducer(s, { type: "RESULT", result: { correct: false } });
    expect(s.phase).toBe("incorrect");
    const redone = runnerReducer(s, { type: "REDO_QUESTION" });
    expect(redone.phase).toBe("answering");
    expect(redone.input).toBe("");
    expect(redone.result).toBeNull();
    expect(redone.index).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd web && npm test -- reducer`
Expected: FAIL (action chưa xử lý).

- [ ] **Step 3: Thêm action vào reducer**

Trong `web/src/components/runner/reducer.ts`:
- `RunnerAction` type thêm: `| { type: "REDO_QUESTION" }`
- Trong `switch`, thêm case:
```ts
case "REDO_QUESTION": {
  // Sau khi đã xem đáp án, người học chọn tự làm lại đúng câu này.
  if (state.phase !== "incorrect" && state.phase !== "correct") return state;
  return { ...state, phase: "answering", input: "", result: null };
}
```

- [ ] **Step 4: Chạy test reducer — PASS**

Run: `cd web && npm test -- reducer`
Expected: PASS.

- [ ] **Step 5: Server trả `correctAnswer` khi sai**

Trong `web/src/app/api/attempts/[id]/answers/route.ts`, câu return cuối, đổi:
```ts
correctAnswer: matchResult.correct ? question.answerRaw : undefined,
```
thành:
```ts
// Hiện đáp án cả khi sai để người học học được — UI kèm nút "Làm lại".
correctAnswer: question.answerRaw,
```
Giữ `keyNote`/`explanation`/`reason` như cũ.

- [ ] **Step 6: UI — khối incorrect hiện đáp án + 2 nút.** Test thất bại trước, trong `ExerciseReview.test.tsx`:

```ts
it("shows the correct answer and Làm lại / Tiếp tục after a wrong answer", async () => {
  // mock fetch trả { correct:false, correctAnswer:"went", keyNote:null }
  // ... submit sai câu 1 ...
  expect(await screen.findByText(/Đáp án:/)).toBeInTheDocument();
  expect(screen.getByText("went")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Làm lại" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeInTheDocument();
});
```

- [ ] **Step 7: Chạy — FAIL**, rồi sửa `ExerciseRunner.tsx` khối `isIncorrect`:

Trong `web/src/components/ExerciseRunner.tsx`:
- Thêm handler:
```ts
function handleRedoQuestion() {
  dispatch({ type: "REDO_QUESTION" });
}
```
- Trong khối card footer (dòng ~357), khi `isIncorrect` đổi nút hiện tại "Thử lại" thành 2 nút:
```tsx
{isIncorrect ? (
  <div className="flex w-full gap-2 sm:w-auto">
    <Button variant="outline" onClick={handleRedoQuestion}>Làm lại</Button>
    <Button onClick={handleContinue}>Tiếp tục</Button>
  </div>
) : isCorrect ? (
  <Button className="w-full sm:w-auto" onClick={handleContinue}>Tiếp tục</Button>
) : (
  <Button
    className="w-full sm:w-auto"
    onClick={handleSubmit}
    disabled={isChecking || state.input.trim() === ""}
  >
    Kiểm tra
  </Button>
)}
```
  (Lưu ý: `handleContinue` khi `isIncorrect` — kiểm tra reducer: `CONTINUE` hiện chỉ chạy khi phase `correct`. Cần cho phép `CONTINUE` từ `incorrect` để "Tiếp tục" bỏ qua câu sai. Sửa case `CONTINUE`: đổi guard `if (state.phase !== "correct") return state;` thành `if (state.phase !== "correct" && state.phase !== "incorrect") return state;`. Thêm test cho nhánh này ở Step 1's file.)
- Trong khối `isIncorrect` (dòng ~374), thêm hiện đáp án khi có `state.result?.correctAnswer` và **không** phải near-miss (`!state.result?.reason`):
```tsx
{state.result?.correctAnswer && !state.result?.reason && (
  <div className="rounded-xl border border-success/30 bg-success-bg p-4">
    <p className="text-sm text-muted-foreground">
      Đáp án: <span className="font-medium text-success">{state.result.correctAnswer}</span>
    </p>
  </div>
)}
```
Với ERROR_CORRECTION, đáp án giờ hiện nhất quán ở đây thay vì lộ qua "💡 Ghi nhớ".

- [ ] **Step 8: Chạy toàn bộ + lint**

Run: `cd web && npm test && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/runner/reducer.ts web/src/components/runner/reducer.test.ts web/src/components/ExerciseRunner.tsx web/src/components/ExerciseReview.test.tsx web/src/app/api/attempts/[id]/answers/route.ts
git commit -m "feat(exercise): reveal answer on wrong attempt with Làm lại/Tiếp tục

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Sửa listening retake bền vững + re-link FK + ghi note hệ thống tương lai

**Hai phần:** (A) khắc phục ngay & chống tái diễn việc `PlacementTest.listeningSetId` bị null sau `npm run seed`; (B) ghi note kiến trúc AI-diagnostic tương lai.

**Nguyên nhân:** `ingest.ts` delete+create ListeningSet (id mới) → FK `SetNull` null hoá → chỉ `seed:placement` re-link. Giải pháp bền: `ingest.ts` **upsert theo slug (giữ id)** thay vì delete+create, để id ổn định và FK không đứt.

**Files:**
- Modify: `web/scripts/seed/ingest.ts` (đổi delete+create ListeningSet → upsert theo slug)
- Modify: `web/scripts/seed/seed-placement.ts` (fail loudly nếu không tìm thấy listening set thay vì ghi null FK)
- Create: `docs/superpowers/plans/2026-07-12-placement-ai-diagnostic-notes.md` (note hệ thống tương lai)
- Verify: chạy seed lại + query DB

**Interfaces:** không có API mới.

- [ ] **Step 1: Đổi ingest.ts sang upsert giữ id**

Trong `web/scripts/seed/ingest.ts` (~dòng 113), thay:
```ts
await db.listeningSet.deleteMany({ where: { slug } });
await db.listeningSet.create({ data: { slug, ... } });
```
bằng upsert theo `slug` (unique) để **giữ nguyên id**, rồi xoá con (Section/Question/variants) để tái tạo nội dung:
```ts
const set = await db.listeningSet.upsert({
  where: { slug },
  create: { slug, /* ...các trường như create cũ... */ },
  update: { /* ...các trường audioUrl/durationSec/title... */ },
});
// Tái tạo nội dung con của set này (không đụng id của set → FK PlacementTest giữ nguyên):
await db.listeningSection.deleteMany({ where: { listeningSetId: set.id } });
// ...tạo lại sections/questions/variants dưới set.id như code cũ...
```
Giữ nguyên khối prune orphan (dòng ~182) nhưng đảm bảo **không** prune `placement_ielts`/`placement_toeic` khi chúng vẫn nằm trong nguồn (`seenSlugs`). Nếu placement sets không do `ingest` seed (chúng nằm ở `content/listening/placement_*.md`?) — kiểm tra: nếu ingest có duyệt chúng thì id sẽ ổn định; nếu không, phần re-link phải do seed-placement lo (Step 2).

- [ ] **Step 2: seed-placement.ts fail loudly khi thiếu set**

Trong `web/scripts/seed/seed-placement.ts` (~dòng 573–583), đổi `console.warn` + tiếp tục thành: nếu `!listeningSet` (và tương tự toeic) thì **throw** với hướng dẫn chạy `npm run seed` trước — không bao giờ ghi `PlacementTest` với FK null:
```ts
if (!listeningSet) {
  throw new Error(
    `[seed-placement] no ListeningSet slug="${LISTENING_SLUG}". Chạy 'npm run seed' trước để không ghi FK null.`,
  );
}
```
(Nếu muốn giữ mềm cho TOEIC set chưa có, chỉ throw cho IELTS set — nhưng mặc định throw cả hai để tránh tái diễn.)

- [ ] **Step 3: Khôi phục dữ liệu hiện tại (một lần)** — vì DB thật đang null FK, chạy lại seed để re-link:

Run:
```bash
cd /home/ncd/learnspaces/learning_english && make seed-all
```
(hoặc `make seed` rồi `docker compose exec web npx tsx scripts/seed/seed-placement.ts`)

- [ ] **Step 4: Xác minh FK đã được re-link**

Run:
```bash
docker compose exec -T db psql -U learning_english -d learning_english -c 'select slug, "listeningSetId", "toeicListeningSetId" from "PlacementTest";'
```
Expected: cả 2 cột **không** null, trỏ tới id của `placement_ielts`/`placement_toeic`.

- [ ] **Step 5: Ghi note hệ thống tương lai** — tạo `docs/superpowers/plans/2026-07-12-placement-ai-diagnostic-notes.md` với nội dung: (a) người band < 4.0 (hoặc TOEIC tương ứng) bắt buộc học lại từ bài 1 — hiện `startLessonFor` cho 3.5–4.99 vào GĐ2, cần chỉnh ngưỡng `< 4.0 → phase_1` khi làm phần AI (chưa làm bây giờ); (b) người band ≥ 4.0: AI chấm chi tiết từng câu placement (dùng `PlacementAttempt.answers` đã lưu server-side) → xác định phần kiến thức yếu → sinh roadmap riêng, đi tới bài GĐ cao; (c) dashboard hiện tại chỉ phục vụ học lại từ đầu / band thấp; roadmap AI sẽ cần UI mới; (d) schema có sẵn chỗ mở rộng: `PlacementAttempt.writingBand`/`writingFeedback` (FUTURE: AI). Không đụng UI trong plan này.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/seed/ingest.ts web/scripts/seed/seed-placement.ts docs/superpowers/plans/2026-07-12-placement-ai-diagnostic-notes.md
git commit -m "fix(seed): keep listening-set ids stable so placement FK survives reseed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verification (end-to-end, sau khi xong 5 task)

1. **Unit/lint:** `cd web && npm test && npm run lint` — tất cả xanh.
2. **Placement gating (Task 1+2):**
   - Đăng nhập, làm placement đạt band cao → dashboard: GĐ được nhảy tới UNLOCKED, các GĐ trước hiện **SKIPPED (⏭, vẫn bấm được)**, không GĐ nào khoá nhầm.
   - Làm lại placement band 0 → GĐ1 **toàn bộ** bài UNLOCKED/khả dụng, **không** còn GĐ2 mở nhầm (kiểm tra DB: không còn row UNLOCKED lạc ở GĐ2).
   - Thử gửi điểm giả: `curl -X POST .../api/placement/complete -d '{"readingAnswers":{},"listeningAnswers":{},"writingText":""}'` (với cookie) → band thấp, **không** nhảy GĐ.
3. **Back-button (Task 3):** làm dở vài câu, reload trang exercise → nút "← Câu trước" bấm được ngay, xem lại đúng các câu đã làm.
4. **Wrong-answer (Task 4):** trả lời sai một câu → hiện "Đáp án: …" + nút "Làm lại" (reset ô, gõ lại, Kiểm tra) và "Tiếp tục" (sang câu sau).
5. **Listening retake (Task 5):** vào `/onboarding/placement` lần nữa (Settings → "Làm lại kiểm tra đầu vào") → phần Nghe hiện `AudioPlayer` + câu hỏi. Chạy `npm run seed` rồi vào lại → **vẫn** hiện (FK không đứt).
