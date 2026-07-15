# Âm thanh & Hiệu ứng hoàn thành — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

App hiện hoàn toàn im lặng ở hai chỗ người học tương tác nhiều nhất: chấm câu trả lời trong bài tập, và học từ vựng (flashcard/quiz — IPA chỉ hiển thị dạng chữ, không nghe được). Màn hình hoàn thành bài tập cũng chỉ là một dấu ✓ tĩnh, dù đây đúng là khoảnh khắc bài học kế tiếp được mở khoá — phần thưởng lớn nhất của lộ trình lại được thể hiện nhạt nhất, và người học còn phải tự quay về dashboard để tìm bài mới.

Kế hoạch này thêm: (1) âm thanh phản hồi đúng/sai khi chấm, (2) phát âm từng từ vựng bằng file MP3 sinh sẵn, (3) confetti + fanfare + CTA "Học bài tiếp theo" khi hoàn thành bài tập.

**Goal:** Thêm âm thanh phản hồi khi trả lời câu hỏi, phát âm từ vựng (audio lưu trong DB), và hiệu ứng confetti + âm thanh chúc mừng khi hoàn thành bài tập mở khoá bài học tiếp theo.

**Architecture:** Ba lớp độc lập. (1) `src/lib/audio/sfx.ts` — singleton cache `HTMLAudioElement` cho 3 file SFX trong `public/sounds/`, an toàn khi SSR/test. (2) Cột **`VocabWord.audioUrl`** (nullable) trỏ tới file phát âm sinh sẵn bằng `edge-tts`; các trang vocab select thêm cột này và truyền xuống `PronounceButton` — từ nào chưa có audio thì không render nút. (3) `src/lib/celebrate.ts` — bọc `canvas-confetti`, tôn trọng `prefers-reduced-motion`. `ExerciseRunner`, `Flashcards`, `QuizGame` chỉ gọi vào ba lớp này.

**Tech Stack:** Next.js 15 + React 19, TypeScript, Prisma 6 + Postgres, Tailwind v4 (`web/src/app/globals.css`), Vitest + Testing Library (jsdom pragma), `canvas-confetti` (mới), `ffmpeg` + `edge-tts` (chỉ dùng offline để sinh asset, không phải runtime dependency).

## Global Constraints

- Toàn bộ code app nằm trong `web/`; test bằng `cd web && npm test`, lint bằng `npm run lint`.
- UI copy bằng **tiếng Việt** (giữ convention song ngữ của repo).
- **Không** thêm toggle bật/tắt âm thanh (quyết định của người dùng).
- Âm thanh phải "fail silent": mọi lỗi phát/tải audio không được throw ra UI.
- Test co-located cạnh source; component test bắt đầu bằng `// @vitest-environment jsdom`.
- **Seed vocab là destructive**: `scripts/seed/ingest.ts:310` chạy `deleteMany` + `createMany` cho `VocabWord` mỗi lần seed. Vì vậy `audioUrl` **phải được backfill lại sau mỗi lần seed** — xem Task 6. Đừng giả định cột này sống sót qua `make seed-all`.
- Commit thường xuyên, mỗi task một commit. Làm việc trực tiếp trên `main` (theo CLAUDE.md).

## File Structure

| File | Trách nhiệm |
|---|---|
| `web/public/sounds/{correct,wrong,complete}.mp3` | 3 asset SFX (sinh bằng ffmpeg, tự tạo → không vướng license) |
| `web/public/audio/vocab/<slug>.mp3` | File phát âm từng từ (sinh bằng script) |
| `web/prisma/schema.prisma` (sửa) | `VocabWord.audioUrl String?` |
| `web/src/lib/audio/sfx.ts` | `playSfx(name)` — cache + play, fail-silent |
| `web/src/lib/audio/vocab-audio.ts` | `slugifyWord()` — chỉ dùng để **đặt tên file**, không phải để suy ra URL lúc chạy |
| `web/src/lib/celebrate.ts` | `celebrate()` — confetti + `prefers-reduced-motion` |
| `web/src/components/vocab/PronounceButton.tsx` | Nút loa 🔊, nhận `src` từ DB |
| `web/scripts/generate-vocab-audio.ts` | Sinh MP3 còn thiếu **và** backfill `audioUrl` cho mọi row |
| `web/scripts/make-sfx.sh` | Sinh 3 file SFX bằng ffmpeg (chạy một lần) |
| `web/src/components/ExerciseRunner.tsx` (sửa) | SFX đúng/sai; màn hình finished: confetti + fanfare + CTA bài kế |
| `web/src/components/vocab/Flashcards.tsx` (sửa) | Nút phát âm ở mặt trước thẻ |
| `web/src/components/vocab/QuizGame.tsx` (sửa) | SFX đúng/sai + nút phát âm khi lộ đáp án |
| `web/src/app/(app)/learn/[phase]/[lesson]/vocab/{flashcards,quiz}/page.tsx` (sửa) | Select thêm `audioUrl` |
| `Makefile` (sửa) | `seed-all` chạy thêm bước backfill audio |

---

### Task 1: Asset SFX + `playSfx()`

**Files:**
- Create: `web/scripts/make-sfx.sh`
- Create: `web/public/sounds/{correct,wrong,complete}.mp3` (do script sinh ra)
- Create: `web/src/lib/audio/sfx.ts`
- Test: `web/src/lib/audio/sfx.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `export type SfxName = "correct" | "wrong" | "complete"`; `export function playSfx(name: SfxName): void`; `export function __resetSfxCacheForTests(): void`

- [ ] **Step 1: Viết script sinh SFX**

`web/scripts/make-sfx.sh`:

```bash
#!/usr/bin/env bash
# Sinh 3 file SFX bằng ffmpeg (chạy MỘT LẦN, output được commit vào git).
# Tự tổng hợp bằng sine wave => không phụ thuộc asset ngoài, không vướng license.
set -euo pipefail
out="$(dirname "$0")/../public/sounds"
mkdir -p "$out"

# correct: hai nốt đi lên (C6 -> E6), ngắn, vui
ffmpeg -y -f lavfi -i "sine=frequency=1047:duration=0.09" \
       -f lavfi -i "sine=frequency=1319:duration=0.16" \
       -filter_complex "[0][1]concat=n=2:v=0:a=1,afade=t=out:st=0.16:d=0.09,volume=0.35" \
       -b:a 96k "$out/correct.mp3"

# wrong: một nốt trầm ngắn (A3), không chói tai
ffmpeg -y -f lavfi -i "sine=frequency=220:duration=0.22" \
       -af "afade=t=out:st=0.12:d=0.10,volume=0.30" \
       -b:a 96k "$out/wrong.mp3"

# complete: fanfare 4 nốt (C6-E6-G6-C7)
ffmpeg -y -f lavfi -i "sine=frequency=1047:duration=0.12" \
       -f lavfi -i "sine=frequency=1319:duration=0.12" \
       -f lavfi -i "sine=frequency=1568:duration=0.12" \
       -f lavfi -i "sine=frequency=2093:duration=0.40" \
       -filter_complex "[0][1][2][3]concat=n=4:v=0:a=1,afade=t=out:st=0.55:d=0.21,volume=0.35" \
       -b:a 96k "$out/complete.mp3"

echo "OK -> $out"
```

- [ ] **Step 2: Chạy script, xác nhận 3 file tồn tại**

```bash
cd web && chmod +x scripts/make-sfx.sh && ./scripts/make-sfx.sh && ls -l public/sounds
```
Expected: 3 file `.mp3`, mỗi file vài KB. (Nếu chưa có ffmpeg: `sudo apt install ffmpeg`.)

- [ ] **Step 3: Viết test thất bại cho `playSfx`**

`web/src/lib/audio/sfx.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";

import { playSfx, __resetSfxCacheForTests } from "@/lib/audio/sfx";

const play = vi.fn(() => Promise.resolve());

beforeEach(() => {
  play.mockClear();
  __resetSfxCacheForTests();
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      preload = "";
      volume = 1;
      constructor(src: string) {
        this.src = src;
      }
      play = play;
    },
  );
});

test("phát đúng file cho từng tên SFX", () => {
  playSfx("correct");
  expect(play).toHaveBeenCalledTimes(1);
});

test("dùng lại cùng một element khi phát lặp lại", () => {
  playSfx("wrong");
  playSfx("wrong");
  expect(play).toHaveBeenCalledTimes(2);
});

test("nuốt lỗi khi trình duyệt chặn autoplay", () => {
  play.mockImplementationOnce(() => Promise.reject(new Error("NotAllowedError")));
  expect(() => playSfx("complete")).not.toThrow();
});
```

- [ ] **Step 4: Chạy test, xác nhận FAIL**

```bash
cd web && npm test -- src/lib/audio/sfx.test.ts
```
Expected: FAIL — `Failed to resolve import "@/lib/audio/sfx"`.

- [ ] **Step 5: Viết implementation tối thiểu**

`web/src/lib/audio/sfx.ts`:

```ts
"use client";

/** Ba hiệu ứng âm thanh của app. File nằm ở `public/sounds/<name>.mp3`. */
export type SfxName = "correct" | "wrong" | "complete";

/** Cache theo tên: tạo `Audio` một lần rồi tua lại, tránh tải lại file mỗi câu. */
const cache = new Map<SfxName, HTMLAudioElement>();

/**
 * Phát một SFX. Không bao giờ throw: trình duyệt có thể chặn autoplay (chưa có
 * user gesture) hoặc file có thể thiếu — cả hai đều không được làm hỏng luồng
 * trả lời câu hỏi.
 */
export function playSfx(name: SfxName): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  try {
    let el = cache.get(name);
    if (!el) {
      el = new Audio(`/sounds/${name}.mp3`);
      el.preload = "auto";
      el.volume = 0.6;
      cache.set(name, el);
    }
    el.currentTime = 0;
    void el.play()?.catch(() => {});
  } catch {
    /* fail silent */
  }
}

export function __resetSfxCacheForTests(): void {
  cache.clear();
}
```

- [ ] **Step 6: Chạy test, xác nhận PASS**

```bash
cd web && npm test -- src/lib/audio/sfx.test.ts && npm run lint
```
Expected: 3 test PASS.

- [ ] **Step 7: Commit**

```bash
git add web/scripts/make-sfx.sh web/public/sounds web/src/lib/audio/sfx.ts web/src/lib/audio/sfx.test.ts
git commit -m "feat(audio): sound effects assets and playSfx helper"
```

---

### Task 2: SFX đúng/sai trong ExerciseRunner

**Files:**
- Modify: `web/src/components/ExerciseRunner.tsx` (`handleSubmit`, khoảng dòng 253-267)
- Test: `web/src/components/ExerciseRunner.sfx.test.tsx` (mới)

**Interfaces:**
- Consumes: `playSfx` từ `@/lib/audio/sfx` (Task 1).
- Produces: không có API mới.

- [ ] **Step 1: Viết test thất bại**

`web/src/components/ExerciseRunner.sfx.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const playSfx = vi.fn();
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));
vi.mock("@/lib/celebrate", () => ({ celebrate: vi.fn() }));

import { ExerciseRunner } from "@/components/ExerciseRunner";

const questions = [
  {
    id: "q1",
    kind: "FILL_BLANK" as const,
    prompt: "She ___ (go) to school.",
    orderIndex: 0,
    options: [],
  },
];

function renderRunner() {
  return render(
    <ExerciseRunner
      exerciseId="e1"
      attemptId="a1"
      initialQuestionNumber={1}
      questions={questions}
      nextLesson={{ slug: "lesson_02", phaseSlug: "phase_1", title: "Bài 2" }}
      backHref="/learn/phase_1/lesson_01"
      lessonTitle="Bài 1"
      linkComponent="a"
    />,
  );
}

function mockAnswer(correct: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ correct, correctAnswer: "goes" }),
      }),
    ),
  );
}

beforeEach(() => {
  playSfx.mockClear();
});

test("phát âm thanh đúng khi trả lời đúng", async () => {
  mockAnswer(true);
  renderRunner();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await waitFor(() => expect(playSfx).toHaveBeenCalledWith("correct"));
});

test("phát âm thanh sai khi trả lời sai", async () => {
  mockAnswer(false);
  renderRunner();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "go" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await waitFor(() => expect(playSfx).toHaveBeenCalledWith("wrong"));
});
```

Ghi chú: nếu `QuestionCard` render input FILL_BLANK không phải `role="textbox"`, dùng `container.querySelector("[data-answer-field]")` thay cho `getByRole("textbox")` — đọc `web/src/components/runner/QuestionCard.tsx` trước khi viết.

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
cd web && npm test -- src/components/ExerciseRunner.sfx.test.tsx
```
Expected: FAIL — `playSfx` chưa được gọi (0 lần).

- [ ] **Step 3: Implement**

Trong `web/src/components/ExerciseRunner.tsx`, thêm import:

```tsx
import { playSfx } from "@/lib/audio/sfx";
```

Sửa cuối `handleSubmit` (đang là `dispatch({ type: "RESULT", result: json })`):

```tsx
    const json = await res.json();
    // Âm thanh phát ngay tại đây (không trong useEffect) để nó nằm trong cùng
    // task với cú click "Kiểm tra" — Safari/iOS chỉ cho phát audio khi còn
    // trong ngữ cảnh của một user gesture.
    playSfx(json.correct ? "correct" : "wrong");
    dispatch({ type: "RESULT", result: json });
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

```bash
cd web && npm test -- src/components/ExerciseRunner.sfx.test.tsx
```
Expected: 2 test PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ExerciseRunner.tsx web/src/components/ExerciseRunner.sfx.test.tsx
git commit -m "feat(exercise): play correct/wrong sound on answer check"
```

---

### Task 3: `celebrate()` — confetti tôn trọng reduced-motion

**Files:**
- Modify: `web/package.json` (thêm dependency)
- Create: `web/src/lib/celebrate.ts`
- Test: `web/src/lib/celebrate.test.ts`

**Interfaces:**
- Consumes: `playSfx` (Task 1).
- Produces: `export function celebrate(): void`.

- [ ] **Step 1: Cài dependency**

```bash
cd web && npm install canvas-confetti && npm install -D @types/canvas-confetti
```
Expected: `canvas-confetti` xuất hiện trong `dependencies`.

- [ ] **Step 2: Viết test thất bại**

`web/src/lib/celebrate.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";

const confetti = vi.fn();
const playSfx = vi.fn();
vi.mock("canvas-confetti", () => ({ default: confetti }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));

import { celebrate } from "@/lib/celebrate";

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })),
  );
}

beforeEach(() => {
  confetti.mockClear();
  playSfx.mockClear();
});

test("bắn confetti và phát fanfare khi không bật reduced-motion", () => {
  stubReducedMotion(false);
  celebrate();
  expect(confetti).toHaveBeenCalled();
  expect(playSfx).toHaveBeenCalledWith("complete");
});

test("bỏ confetti nhưng vẫn phát fanfare khi bật reduced-motion", () => {
  stubReducedMotion(true);
  celebrate();
  expect(confetti).not.toHaveBeenCalled();
  expect(playSfx).toHaveBeenCalledWith("complete");
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
cd web && npm test -- src/lib/celebrate.test.ts
```
Expected: FAIL — không resolve được `@/lib/celebrate`.

- [ ] **Step 4: Implement**

`web/src/lib/celebrate.ts`:

```ts
"use client";

import confetti from "canvas-confetti";

import { playSfx } from "@/lib/audio/sfx";

/**
 * Ăn mừng khi hoàn thành bài tập: confetti + fanfare.
 * Âm thanh luôn phát (đó là phản hồi, không phải chuyển động); confetti bị bỏ
 * qua nếu người dùng đặt `prefers-reduced-motion: reduce`.
 */
export function celebrate(): void {
  if (typeof window === "undefined") return;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (!reduced) {
    // Hai chùm bắn chéo từ hai mép dưới — đọc rõ trên cả màn hình điện thoại.
    const shared = { particleCount: 60, spread: 70, startVelocity: 45, ticks: 160 };
    confetti({ ...shared, origin: { x: 0.15, y: 0.9 }, angle: 60 });
    confetti({ ...shared, origin: { x: 0.85, y: 0.9 }, angle: 120 });
  }
  playSfx("complete");
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

```bash
cd web && npm test -- src/lib/celebrate.test.ts && npm run lint
```
Expected: 2 test PASS.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/celebrate.ts web/src/lib/celebrate.test.ts
git commit -m "feat(audio): celebrate() confetti + fanfare helper"
```

---

### Task 4: Màn hình hoàn thành — confetti, fanfare, mở khoá bài kế

**Files:**
- Modify: `web/src/components/ExerciseRunner.tsx` (nhánh `state.phase === "finished"`, dòng 269-296)
- Modify: `web/src/app/globals.css` (thêm keyframes `unlock-pop`)
- Test: `web/src/components/ExerciseRunner.finish.test.tsx` (mới)

**Interfaces:**
- Consumes: `celebrate()` (Task 3); prop `nextLesson: NextLessonInfo | null` đã có sẵn (`{ slug, phaseSlug, title }`).
- Produces: không có API mới.

- [ ] **Step 1: Viết test thất bại**

`web/src/components/ExerciseRunner.finish.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const celebrate = vi.fn();
vi.mock("@/lib/celebrate", () => ({ celebrate }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx: vi.fn() }));

import { ExerciseRunner } from "@/components/ExerciseRunner";

const questions = [
  { id: "q1", kind: "FILL_BLANK" as const, prompt: "She ___ (go).", orderIndex: 0, options: [] },
];

beforeEach(() => {
  celebrate.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ correct: true, correctAnswer: "goes" }),
      }),
    ),
  );
});

async function finishExercise() {
  render(
    <ExerciseRunner
      exerciseId="e1"
      attemptId="a1"
      initialQuestionNumber={1}
      questions={questions}
      nextLesson={{ slug: "lesson_02", phaseSlug: "phase_1", title: "Bài 2: Thì quá khứ" }}
      backHref="/learn/phase_1/lesson_01"
      lessonTitle="Bài 1"
      linkComponent="a"
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "goes" } });
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
  await screen.findByRole("button", { name: "Tiếp tục" });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
}

test("gọi celebrate() đúng một lần khi vào màn hình hoàn thành", async () => {
  await finishExercise();
  await screen.findByText("Hoàn thành bài tập!");
  await waitFor(() => expect(celebrate).toHaveBeenCalledTimes(1));
});

test("hiện link sang bài học vừa mở khoá", async () => {
  await finishExercise();
  const link = await screen.findByRole("link", { name: /Học bài tiếp theo/ });
  expect(link).toHaveAttribute("href", "/learn/phase_1/lesson_02");
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
cd web && npm test -- src/components/ExerciseRunner.finish.test.tsx
```
Expected: FAIL — `celebrate` gọi 0 lần / không tìm thấy link.

- [ ] **Step 3: Thêm keyframes vào `globals.css`**

Thêm cạnh các `@keyframes` sẵn có (`pop`, `shake`, `flame`) trong `web/src/app/globals.css`:

```css
@keyframes unlock-pop {
  0% { transform: scale(0.6) rotate(-12deg); opacity: 0; }
  60% { transform: scale(1.12) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

@utility animate-unlock-pop {
  animation: unlock-pop 620ms var(--ease-standard) both;
}
```

- [ ] **Step 4: Implement nhánh `finished`**

Trong `web/src/components/ExerciseRunner.tsx` thêm import:

```tsx
import { celebrate } from "@/lib/celebrate";
```

Thêm effect trong `ExerciseRunnerSession` (đặt cạnh `useEffect` autofocus, TRƯỚC mọi `return` sớm — hook không được gọi có điều kiện):

```tsx
  // Ăn mừng đúng MỘT lần khi vào phase "finished". `state.phase` chỉ chuyển
  // sang "finished" một lần trên mỗi attempt (redo remount cả component qua
  // `key`), nên deps này đã đủ — không cần cờ "đã bắn" riêng.
  useEffect(() => {
    if (state.phase === "finished") celebrate();
  }, [state.phase]);
```

Thay khối `if (state.phase === "finished")` bằng:

```tsx
  if (state.phase === "finished") {
    const nextHref = nextLesson ? `/learn/${nextLesson.phaseSlug}/${nextLesson.slug}` : null;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center lg:mx-auto lg:max-w-xl">
        <div className="flex size-16 items-center justify-center rounded-full bg-success text-2xl text-success-foreground animate-pop">
          ✓
        </div>
        <h2 className="text-h2 font-extrabold">Hoàn thành bài tập!</h2>
        {nextLesson && nextHref ? (
          <>
            <span className="animate-unlock-pop rounded-full bg-streak-bg px-3 py-1.5 text-sm font-semibold text-streak-foreground">
              🔓 Đã mở khoá: {nextLesson.title}
            </span>
            <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href={nextHref}
                className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}
              >
                Học bài tiếp theo →
              </Link>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
              >
                Về lộ trình học
              </Link>
              <Button variant="ghost" className="w-full sm:w-auto" onClick={onRedo}>
                Làm lại
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Bạn đã hoàn thành toàn bộ lộ trình hiện có!</p>
            <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}
              >
                Về lộ trình học
              </Link>
              <Button variant="outline" className="w-full sm:w-auto" onClick={onRedo}>
                Làm lại
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }
```

- [ ] **Step 5: Chạy toàn bộ test + lint**

```bash
cd web && npm test && npm run lint
```
Expected: tất cả PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/ExerciseRunner.tsx web/src/components/ExerciseRunner.finish.test.tsx web/src/app/globals.css
git commit -m "feat(exercise): confetti + fanfare + unlock CTA on completion"
```

---

### Task 5: Cột `VocabWord.audioUrl` + quy ước đặt tên file

**Files:**
- Modify: `web/prisma/schema.prisma` (model `VocabWord`, dòng 94-107)
- Create: `web/prisma/migrations/<timestamp>_vocab_audio_url/migration.sql` (do `prisma migrate dev` sinh)
- Create: `web/src/lib/audio/vocab-audio.ts`
- Test: `web/src/lib/audio/vocab-audio.test.ts`

**Interfaces:**
- Consumes: —
- Produces: cột `VocabWord.audioUrl String?`; `export function slugifyWord(word: string): string`; `export function vocabAudioPath(word: string): string` (trả `/audio/vocab/<slug>.mp3`).

`slugifyWord`/`vocabAudioPath` chỉ dùng **trong script sinh audio** để đặt tên file và tính giá trị ghi vào `audioUrl`. UI **không** gọi chúng — UI đọc thẳng `audioUrl` từ DB, nên sau này một từ có thể trỏ tới file bất kỳ (giọng UK/US, audio người thật) mà không phá quy ước.

- [ ] **Step 1: Thêm cột vào schema**

Trong `web/prisma/schema.prisma`, model `VocabWord`:

```prisma
model VocabWord {
  id         String          @id @default(cuid())
  lessonId   String
  lesson     Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  groupName  String
  word       String
  ipa        String
  meaningVi  String
  exampleEn  String
  /// Đường dẫn file phát âm dưới `public/`, ví dụ `/audio/vocab/take-off.mp3`.
  /// Null = chưa sinh audio cho từ này; UI ẩn nút loa. Được backfill bởi
  /// `scripts/generate-vocab-audio.ts` — LƯU Ý: seed vocab là delete+create,
  /// nên phải chạy lại script sau mỗi lần seed.
  audioUrl   String?
  orderIndex Int
  progress   VocabProgress[]

  @@unique([lessonId, orderIndex])
}
```

- [ ] **Step 2: Tạo migration**

```bash
cd web && npm run db:migrate -- --name vocab_audio_url
```
Expected: sinh `prisma/migrations/<ts>_vocab_audio_url/migration.sql` chứa `ALTER TABLE "VocabWord" ADD COLUMN "audioUrl" TEXT;`, Prisma Client regenerate xong.

- [ ] **Step 3: Viết test thất bại cho helper đặt tên file**

`web/src/lib/audio/vocab-audio.test.ts`:

```ts
import { expect, test } from "vitest";

import { slugifyWord, vocabAudioPath } from "@/lib/audio/vocab-audio";

test("hạ chữ thường và thay khoảng trắng bằng gạch ngang", () => {
  expect(slugifyWord("Take off")).toBe("take-off");
});

test("bỏ ký tự không phải chữ/số", () => {
  expect(slugifyWord("mother-in-law's")).toBe("mother-in-law-s");
});

test("gộp gạch ngang thừa và cắt hai đầu", () => {
  expect(slugifyWord("  to  be   (v.) ")).toBe("to-be-v");
});

test("vocabAudioPath trỏ vào public/audio/vocab", () => {
  expect(vocabAudioPath("Take off")).toBe("/audio/vocab/take-off.mp3");
});
```

- [ ] **Step 4: Chạy test, xác nhận FAIL**

```bash
cd web && npm test -- src/lib/audio/vocab-audio.test.ts
```
Expected: FAIL — không resolve được module.

- [ ] **Step 5: Implement**

`web/src/lib/audio/vocab-audio.ts`:

```ts
/**
 * Quy ước ĐẶT TÊN FILE phát âm từ vựng. Chỉ dùng bởi
 * `scripts/generate-vocab-audio.ts` khi sinh file và ghi `VocabWord.audioUrl`.
 * UI đọc `audioUrl` từ DB chứ không suy ra đường dẫn từ chữ — nhờ vậy một từ
 * có thể trỏ tới file phát âm bất kỳ mà không cần đúng quy ước này.
 */
export function slugifyWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu (phòng café/naïve)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function vocabAudioPath(word: string): string {
  return `/audio/vocab/${slugifyWord(word)}.mp3`;
}
```

- [ ] **Step 6: Chạy test, xác nhận PASS**

```bash
cd web && npm test -- src/lib/audio/vocab-audio.test.ts && npm run lint
```
Expected: 4 test PASS.

- [ ] **Step 7: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/migrations web/src/lib/audio/vocab-audio.ts web/src/lib/audio/vocab-audio.test.ts
git commit -m "feat(vocab): audioUrl column and file-naming convention"
```

---

### Task 6: Script sinh MP3 + backfill `audioUrl` (idempotent, chạy sau seed)

**Files:**
- Create: `web/scripts/generate-vocab-audio.ts`
- Modify: `web/package.json` (script `audio:vocab`)
- Modify: `Makefile` (repo root — `seed-all` gọi thêm bước này)

**Interfaces:**
- Consumes: `slugifyWord`, `vocabAudioPath` (Task 5); Prisma client `@/lib/db`; model `VocabWord { word, audioUrl }`.
- Produces: file `web/public/audio/vocab/<slug>.mp3` + giá trị `audioUrl` cho mọi row có file tương ứng.

Công cụ TTS: `edge-tts` (Python, free, không cần API key, giọng `en-US-AriaNeural`). Chỉ chạy offline khi sinh asset — **không** phải runtime dependency.

Script làm hai việc, tách bạch: (a) sinh file cho từ nào **chưa có file**; (b) `updateMany` `audioUrl` cho **mọi** row khớp chữ — kể cả row vừa được seed lại lúc nãy và đang `null`. Nhờ (b), chạy lại sau `make seed-all` là đủ để khôi phục cột, không phải sinh lại mp3.

- [ ] **Step 1: Cài edge-tts và thử một từ**

```bash
pipx install edge-tts || pip install --user edge-tts
edge-tts --voice en-US-AriaNeural --text "hello" --write-media /tmp/hello.mp3 && ls -l /tmp/hello.mp3
```
Expected: file mp3 ~10KB.

- [ ] **Step 2: Viết script**

`web/scripts/generate-vocab-audio.ts`:

```ts
/**
 * Sinh file phát âm cho mọi từ trong bảng VocabWord và backfill cột `audioUrl`.
 *
 *   cd web && npm run audio:vocab
 *
 * PHẢI CHẠY LẠI SAU MỖI LẦN SEED: `scripts/seed/ingest.ts` xoá + tạo lại toàn
 * bộ VocabWord của một lesson, nên `audioUrl` về null. Chạy lại script là đủ —
 * file mp3 đã có sẵn thì bước sinh audio bị bỏ qua, chỉ cột được ghi lại.
 *
 * Yêu cầu: `edge-tts` có trong PATH (pipx install edge-tts).
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { db } from "@/lib/db";
import { slugifyWord, vocabAudioPath } from "@/lib/audio/vocab-audio";

const run = promisify(execFile);
const VOICE = "en-US-AriaNeural";
const OUT_DIR = path.join(process.cwd(), "public", "audio", "vocab");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const rows = await db.vocabWord.findMany({ select: { word: true } });
  // Nhiều lesson dùng chung một từ => một file duy nhất cho mỗi slug.
  const unique = new Map<string, string>(); // slug -> word (bản gốc, để đọc)
  for (const { word } of rows) {
    const slug = slugifyWord(word);
    if (slug !== "" && !unique.has(slug)) unique.set(slug, word);
  }

  let made = 0;
  let existed = 0;
  const readySlugs: string[] = [];

  for (const [slug, word] of unique) {
    const file = path.join(OUT_DIR, `${slug}.mp3`);
    if (existsSync(file)) {
      existed++;
      readySlugs.push(slug);
      continue;
    }
    try {
      await run("edge-tts", ["--voice", VOICE, "--text", word, "--write-media", file]);
      made++;
      readySlugs.push(slug);
      console.log(`✓ ${word} -> ${slug}.mp3`);
    } catch (err) {
      // Một từ hỏng không được làm hỏng cả lần chạy: bỏ qua, `audioUrl` giữ
      // null, UI đơn giản là không hiện nút loa cho từ đó.
      console.error(`✗ ${word}: ${(err as Error).message}`);
    }
  }

  // Backfill cột cho MỌI row có file sẵn sàng — kể cả row vừa bị seed ghi lại.
  let updated = 0;
  for (const slug of readySlugs) {
    const word = unique.get(slug)!;
    const res = await db.vocabWord.updateMany({
      where: { word },
      data: { audioUrl: vocabAudioPath(word) },
    });
    updated += res.count;
  }

  console.log(
    `\nFile: ${made} mới, ${existed} đã có. Đã ghi audioUrl cho ${updated} dòng / ${rows.length} từ.`,
  );
  await db.$disconnect();
}

void main();
```

- [ ] **Step 3: Thêm npm script**

Trong `web/package.json`, mục `"scripts"` (đặt cạnh các script `seed:*` để bám đúng cách nạp env đang dùng):

```json
    "audio:vocab": "dotenv -e .env.local -- tsx scripts/generate-vocab-audio.ts",
```

- [ ] **Step 4: Chạy script, xác nhận cột được ghi**

```bash
cd web && npm run audio:vocab && ls public/audio/vocab | wc -l
```
Expected: in `File: N mới, 0 đã có. Đã ghi audioUrl cho M dòng / M từ.` Chạy lần hai → `File: 0 mới, N đã có.`

Kiểm tra trong DB:

```bash
cd /home/ncd/learnspaces/learning_english && make dbsh
```
rồi:

```sql
SELECT count(*) FILTER (WHERE "audioUrl" IS NOT NULL) AS co_audio, count(*) AS tong FROM "VocabWord";
```
Expected: `co_audio` = `tong` (hoặc chênh đúng bằng số từ edge-tts báo lỗi).

- [ ] **Step 5: Nối vào `seed-all` để cột không "chết" sau mỗi lần seed**

Trong `Makefile` (repo root), thêm bước sinh/backfill audio vào cuối target `seed-all` — đọc target hiện tại trước, giữ nguyên các bước đang có và chèn dòng cuối:

```make
	docker compose exec web npm run audio:vocab
```

Nếu container `web` không có `edge-tts` (rất có thể), thay bằng: giữ `audio:vocab` chạy **ngoài** container, và thêm chú thích ngay trên target rằng phải chạy `cd web && npm run audio:vocab` sau `make seed-all`. Chọn cách nào cũng được — điều bắt buộc là bước backfill phải nằm trong quy trình seed bằng văn bản, không phải chỉ trong đầu người viết.

- [ ] **Step 6: Commit (kèm assets)**

Assets được commit để production không cần chạy TTS. Kiểm tra dung lượng trước: `du -sh web/public/audio/vocab` — nếu > ~50MB, chuyển sang volume/CDN thay vì commit.

```bash
cd /home/ncd/learnspaces/learning_english
git add web/scripts/generate-vocab-audio.ts web/package.json web/public/audio/vocab Makefile
git commit -m "feat(vocab): generate pronunciation MP3s and backfill audioUrl"
```

---

### Task 7: `PronounceButton` + phát âm trong Flashcards

**Files:**
- Create: `web/src/components/vocab/PronounceButton.tsx`
- Modify: `web/src/components/vocab/Flashcards.tsx` (interface `FlashcardWord` + mặt trước thẻ, dòng 8-15 và 143-148)
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/flashcards/page.tsx:34` (thêm `audioUrl: true` vào `select`)
- Test: `web/src/components/vocab/PronounceButton.test.tsx`

**Interfaces:**
- Consumes: `VocabWord.audioUrl` (Task 5).
- Produces: `export function PronounceButton({ src, label, className }: { src: string; label: string; className?: string })` — component **không** tự suy ra đường dẫn; nơi gọi phải truyền `src` lấy từ DB, và tự bỏ render khi `audioUrl` null.

- [ ] **Step 1: Viết test thất bại**

`web/src/components/vocab/PronounceButton.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { PronounceButton } from "@/components/vocab/PronounceButton";

const play = vi.fn(() => Promise.resolve());
let created: string[] = [];

beforeEach(() => {
  play.mockClear();
  created = [];
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      constructor(src: string) {
        this.src = src;
        created.push(src);
      }
      play = play;
    },
  );
});

test("phát đúng file được truyền vào", () => {
  render(<PronounceButton src="/audio/vocab/take-off.mp3" label="Take off" />);
  fireEvent.click(screen.getByRole("button", { name: /Phát âm/ }));
  expect(created).toEqual(["/audio/vocab/take-off.mp3"]);
  expect(play).toHaveBeenCalledTimes(1);
});

test("bấm không kích hoạt vùng bấm bao ngoài (chặn nổi bọt)", () => {
  const onParentClick = vi.fn();
  render(
    <div onClick={onParentClick}>
      <PronounceButton src="/audio/vocab/hello.mp3" label="hello" />
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Phát âm/ }));
  expect(onParentClick).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
cd web && npm test -- src/components/vocab/PronounceButton.test.tsx
```
Expected: FAIL — không resolve được component.

- [ ] **Step 3: Implement**

`web/src/components/vocab/PronounceButton.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Nút loa phát file phát âm của một từ. `src` đến từ `VocabWord.audioUrl`
 * (do `scripts/generate-vocab-audio.ts` ghi) — nơi gọi chịu trách nhiệm KHÔNG
 * render nút này khi `audioUrl` là null.
 *
 * Nút thường nằm BÊN TRONG một vùng bấm khác (thẻ flashcard lật khi bấm), nên
 * phải `stopPropagation` — nếu không, bấm loa sẽ lật thẻ.
 */
export function PronounceButton({
  src,
  label,
  className,
}: {
  src: string;
  /** Từ đang phát — chỉ dùng cho `aria-label`. */
  label: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (typeof Audio === "undefined") return;
    let el = audioRef.current;
    if (!el) {
      el = new Audio(src);
      audioRef.current = el;
    }
    el.currentTime = 0;
    void el.play()?.catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Phát âm: ${label}`}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary",
        className,
      )}
    >
      <Volume2 className="size-5" aria-hidden />
    </button>
  );
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

```bash
cd web && npm test -- src/components/vocab/PronounceButton.test.tsx
```
Expected: 2 test PASS.

- [ ] **Step 5: Đưa `audioUrl` từ DB xuống Flashcards**

`web/src/app/(app)/learn/[phase]/[lesson]/vocab/flashcards/page.tsx:34` — thêm vào `select`:

```ts
    select: { id: true, word: true, ipa: true, meaningVi: true, exampleEn: true, groupName: true, audioUrl: true },
```

`web/src/components/vocab/Flashcards.tsx` — mở rộng interface:

```tsx
export interface FlashcardWord {
  id: string;
  word: string;
  ipa: string;
  meaningVi: string;
  exampleEn: string;
  groupName: string;
  /** Null khi chưa sinh audio cho từ này — khi đó không render nút loa. */
  audioUrl: string | null;
}
```

thêm import và sửa mặt trước thẻ (khối "Front: word + IPA"):

```tsx
import { PronounceButton } from "@/components/vocab/PronounceButton";
```

```tsx
          <div className="absolute inset-0 backface-hidden rounded-2xl border bg-card flex flex-col items-center justify-center gap-2 p-6">
            <div className="flex items-center gap-2">
              <p className="text-center text-h1 font-extrabold">{card.word}</p>
              {card.audioUrl && <PronounceButton src={card.audioUrl} label={card.word} />}
            </div>
            {card.ipa !== "" && <p className="text-muted-foreground">/{card.ipa}/</p>}
            <p className="mt-4 text-caption text-muted-foreground">Nhấn để xem nghĩa ↻</p>
          </div>
```

Lưu ý HTML: thẻ flashcard hiện là một `<button>`; đặt nút loa lồng trong button là markup không hợp lệ. Đổi phần tử lật thẻ sang `<div role="button" tabIndex={0} onClick={...} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }} ...>`, giữ nguyên `aria-label`, `data-testid="flashcard"`, `data-flipped` để test hiện có không vỡ.

- [ ] **Step 6: Chạy toàn bộ test + lint**

```bash
cd web && npm test && npm run lint
```
Expected: tất cả PASS (đặc biệt các test bám `data-testid="flashcard"`).

- [ ] **Step 7: Commit**

```bash
git add web/src/components/vocab/PronounceButton.tsx web/src/components/vocab/PronounceButton.test.tsx web/src/components/vocab/Flashcards.tsx "web/src/app/(app)/learn/[phase]/[lesson]/vocab/flashcards/page.tsx"
git commit -m "feat(vocab): pronunciation button on flashcards"
```

---

### Task 8: Âm thanh trong QuizGame (đúng/sai + phát âm khi lộ đáp án)

**Files:**
- Modify: `web/src/components/vocab/QuizGame.tsx`
- Modify: `web/src/components/vocab/games.ts` (type `VocabWordLite` — thêm `audioUrl`)
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/quiz/page.tsx:34` (`select` thêm `audioUrl: true`)
- Test: `web/src/components/vocab/QuizGame.audio.test.tsx` (mới)

**Interfaces:**
- Consumes: `playSfx` (Task 1), `PronounceButton` (Task 7), `VocabWord.audioUrl` (Task 5).
- Produces: `VocabWordLite` có thêm `audioUrl: string | null`.

- [ ] **Step 1: Đọc component để nắm tên biến thật**

```bash
cd web && sed -n 60,200p src/components/vocab/QuizGame.tsx && cat src/components/vocab/games.ts
```
Ghi lại: handler chọn đáp án (nơi tính `correct`), tên field của từ trong `QuizRound`, và `VocabWordLite`. Dùng đúng những tên đó ở các step dưới.

- [ ] **Step 2: Viết test thất bại**

`web/src/components/vocab/QuizGame.audio.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const playSfx = vi.fn();
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));

import { QuizGame } from "@/components/vocab/QuizGame";

const words = [
  { id: "w1", word: "apple", meaningVi: "quả táo", audioUrl: "/audio/vocab/apple.mp3" },
  { id: "w2", word: "book", meaningVi: "quyển sách", audioUrl: "/audio/vocab/book.mp3" },
  { id: "w3", word: "cat", meaningVi: "con mèo", audioUrl: null },
  { id: "w4", word: "dog", meaningVi: "con chó", audioUrl: null },
];

beforeEach(() => {
  playSfx.mockClear();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));
});

test("phát SFX khi người học chọn một đáp án", async () => {
  render(<QuizGame words={words} backHref="/vocab" linkComponent="a" />);
  // Vòng đầu tiên dựng trong useEffect; đợi các lựa chọn xuất hiện.
  const options = await screen.findAllByTestId("quiz-option");
  fireEvent.click(options[0]);
  expect(playSfx).toHaveBeenCalledTimes(1);
  expect(["correct", "wrong"]).toContain(playSfx.mock.calls[0][0]);
});
```

Nếu các nút lựa chọn chưa có `data-testid="quiz-option"`, thêm attribute đó vào phần tử option trong `QuizGame.tsx`.

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
cd web && npm test -- src/components/vocab/QuizGame.audio.test.tsx
```
Expected: FAIL — `playSfx` gọi 0 lần.

- [ ] **Step 4: Implement**

`web/src/components/vocab/games.ts` — thêm field vào `VocabWordLite`:

```ts
  /** Null khi chưa sinh audio; UI không render nút loa. */
  audioUrl: string | null;
```

`web/src/app/(app)/learn/[phase]/[lesson]/vocab/quiz/page.tsx:34`:

```ts
    select: { id: true, word: true, meaningVi: true, audioUrl: true },
```

`web/src/components/vocab/QuizGame.tsx` — import:

```tsx
import { playSfx } from "@/lib/audio/sfx";
import { PronounceButton } from "@/components/vocab/PronounceButton";
```

Trong handler chọn đáp án, ngay nơi đã có `correct: boolean`, thêm trước các `setState`:

```tsx
    playSfx(correct ? "correct" : "wrong");
```

Sau khi đã chọn (`selectedId !== null`), hiện nút nghe lại từ tiếng Anh của round (thay `round.word` bằng đúng tên field đọc được ở Step 1):

```tsx
    {selectedId !== null && round.word.audioUrl && (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Nghe lại:</span>
        <span className="font-semibold text-foreground">{round.word.word}</span>
        <PronounceButton src={round.word.audioUrl} label={round.word.word} />
      </div>
    )}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

```bash
cd web && npm test && npm run lint
```
Expected: tất cả PASS — kể cả `games.test.ts` hiện có (nếu nó dựng object `VocabWordLite` thủ công, thêm `audioUrl: null` vào fixture).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/vocab/QuizGame.tsx web/src/components/vocab/games.ts web/src/components/vocab/QuizGame.audio.test.tsx "web/src/app/(app)/learn/[phase]/[lesson]/vocab/quiz/page.tsx"
git commit -m "feat(vocab): quiz answer sounds and replay pronunciation"
```

---

### Task 9: Kiểm thử end-to-end trong app thật

**Files:** không sửa file nào (chỉ chạy và quan sát).

- [ ] **Step 1: Chạy app**

```bash
cd /home/ncd/learnspaces/learning_english && make up && make logs
```
Hoặc dev local: `cd web && npm run dev`.

- [ ] **Step 2: Kiểm tra thủ công (bật loa)**

Mở `http://localhost:3000`, đăng nhập, xác nhận từng mục:

1. Bài tập → trả lời **đúng** → nghe tiếng "ding" đi lên.
2. Trả lời **sai** → nghe tiếng trầm ngắn; UI vẫn hiện đáp án + ghi nhớ như cũ.
3. Hết câu cuối → màn hình "Hoàn thành bài tập!" bắn **confetti**, phát **fanfare**, chip "🔓 Đã mở khoá: <tên bài>" có animation, nút **"Học bài tiếp theo →"** trỏ đúng `/learn/<phase>/<lesson kế>`.
4. Bấm "Học bài tiếp theo" → vào được bài mới (không bị redirect về dashboard ⇒ đã UNLOCKED).
5. Từ vựng → Flashcards → nút loa ở mặt trước phát đúng phát âm; bấm loa **không** làm lật thẻ.
6. Từ vựng → Quiz → chọn đáp án → nghe SFX đúng/sai; "Nghe lại" phát âm từ.
7. Bật reduced-motion (DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce) → hoàn thành bài tập → **không** confetti nhưng **vẫn** có fanfare.

- [ ] **Step 3: Kiểm tra vòng đời cột `audioUrl` qua một lần re-seed**

Đây là điểm dễ vỡ nhất của thiết kế này — phải thử thật:

```bash
cd /home/ncd/learnspaces/learning_english && make seed-all
```
rồi mở lại Flashcards. Nút loa phải **vẫn còn**. Nếu mất ⇒ bước backfill ở Task 6 Step 5 chưa nằm trong `seed-all`; chạy `cd web && npm run audio:vocab` và sửa lại `Makefile` cho đúng.

- [ ] **Step 4: Kiểm tra không có 404 audio**

DevTools → Network → lọc `Media`: không được có 404 tới `/sounds/*` hay `/audio/vocab/*`.

- [ ] **Step 5: Chốt toàn bộ kiểm thử tự động**

```bash
cd web && npm test && npm run lint
```
Expected: toàn bộ PASS.

- [ ] **Step 6: Commit (nếu có sửa phát sinh)**

```bash
git commit -am "fix(audio): follow-ups from manual verification"
```

---

## Verification

- **Tự động:** `cd web && npm test` (gồm `sfx.test.ts`, `vocab-audio.test.ts`, `celebrate.test.ts`, `PronounceButton.test.tsx`, `ExerciseRunner.sfx.test.tsx`, `ExerciseRunner.finish.test.tsx`, `QuizGame.audio.test.tsx`) và `npm run lint`.
- **DB:** `make dbsh` → `SELECT count(*) FILTER (WHERE "audioUrl" IS NOT NULL), count(*) FROM "VocabWord";` — hai số phải bằng nhau.
- **Thủ công:** checklist 7 mục ở Task 9 Step 2, **cộng với** bài kiểm tra re-seed ở Step 3 — jsdom không phát ra tiếng, và không test tự động nào bắt được lỗi "seed xoá mất `audioUrl`".
