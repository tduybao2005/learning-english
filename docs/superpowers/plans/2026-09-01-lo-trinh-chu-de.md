# Lộ trình theo chủ đề + Phát âm thay SFX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Khi bắt đầu execute:** copy file này sang `docs/superpowers/plans/2026-09-01-lo-trinh-chu-de.md` và commit, để plan sống cùng repo (plan mode chỉ cho ghi vào `~/.claude/plans/`).

**Goal:** Thay lộ trình chia theo 5 giai đoạn bằng trang `/learn` duyệt theo 15 chủ đề bài học (hub → chủ đề → bài), và thay tiếng "ting ting" khi trả lời đúng bằng phát âm chính từ tiếng Anh đó.

**Architecture:** Ba khối độc lập, ship theo thứ tự rủi ro tăng dần. (A) Lớp âm thanh: một module `word-audio.ts` mới, dùng chung cho bàn ghép cặp và câu trắc nghiệm, cắt ngang file đang phát. (B) Taxonomy 52 bài → 15 chủ đề là **hằng số TypeScript** thuần trong `web/src/lib/lesson-topics.ts` — không migration, không seed, không COPY vào Docker image. (C) Hai route mới `/learn` và `/learn/chu-de/[topic]` theo đúng kiến trúc trang Từ vựng đã duyệt; `/learn/[phase]/[lesson]` giữ nguyên URL nên không link nào hỏng.

**Tech Stack:** Next.js 15 App Router (server components), React 19, TypeScript, Tailwind v4, Prisma + Postgres, Vitest 4 + Testing Library (test đặt cạnh source), Docker Compose.

**Spec:** Không có file spec riêng — các quyết định thiết kế do người dùng chốt trực tiếp, chép nguyên văn ở **Quyết định đã chốt** bên dưới.

---

## Quyết định đã chốt (người dùng chọn, không được tự đổi)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Khoá bài khi nhóm theo chủ đề | **Bỏ khoá hoàn toàn.** Mọi bài đều vào được. Thẻ bài chỉ hiện Đã học / Đang học / Chưa học, y hệt trang Từ vựng. |
| 2 | Đặt lộ trình mới ở đâu | **Trang `/learn` mới, 2 tầng.** `/learn` = lưới thẻ chủ đề; `/learn/chu-de/[slug]` = danh sách bài. `/dashboard` chỉ còn "Tiếp tục" + "Tuần này". URL bài học `/learn/[phase]/[lesson]` **giữ nguyên**. |
| 3 | Lưu taxonomy ở đâu | **Hằng số TS** `web/src/lib/lesson-topics.ts`. Không migration, không seed, không TSV, không Dockerfile COPY. |
| 4 | Âm thanh khi ghép/chọn đúng | **Cắt ngang + im lặng nếu thiếu mp3.** Ghép/chọn đúng → đọc ngay từ tiếng Anh, dừng file đang đọc dở. Không có `audioUrl` → không phát gì (KHÔNG quay lại ting). Trả lời **SAI** vẫn giữ nguyên `playSfx("wrong")`. |

## Global Constraints

- **Ngôn ngữ giao diện:** tiêu đề/nhãn tiếng Việt, ví dụ và thuật ngữ tiếng Anh. Không dịch nội dung đã có.
- **Hệ thiết kế:** indigo-violet primary + coral accent. Dùng token Tailwind sẵn có (`bg-primary`, `text-muted-foreground`, `bg-success`, `bg-streak`, `border-border`, `bg-card`), **không** hardcode mã màu hex.
- **Mẫu để bám theo:** `web/src/app/(app)/vocab/page.tsx` (hub) và `web/src/app/(app)/vocab/[topic]/page.tsx` (hero + progress ring + nút lớn) — đây chính là bản thiết kế người dùng đã duyệt. Đọc cả hai trước khi viết Task 6/7.
- **Chạm tối thiểu 44px:** mọi nút/link bấm được phải có `min-h-11`.
- **Theme-aware + responsive:** không để trang cuộn ngang ở viewport 430px. Hàng lọc dùng `grid`, không dùng `flex overflow-x-auto` (bài học từ lần sửa `TopicWordList`).
- **Test:** `cd web && npm test` (script này = `dotenv -e .env.local -- vitest run`). Chạy `npx vitest` trần sẽ hỏng với `Environment variable not found: DATABASE_URL`.
- **TDD bắt buộc:** mọi task phải xem test FAIL trước khi viết code. Không có ngoại lệ.
- **Không đụng schema Prisma.** Toàn bộ plan này không có migration, không `make seed-all`, không rebuild bắt buộc ngoài `make up` cuối cùng.
- **Làm việc thẳng trên `main`** (theo `CLAUDE.md`).

---

## Bản đồ file

**Tạo mới**

| File | Trách nhiệm |
|---|---|
| `web/src/lib/audio/word-audio.ts` | Phát mp3 phát âm của một từ, cắt file đang phát. Thuần, không React. |
| `web/src/lib/audio/word-audio.test.ts` | Test cho trên. |
| `web/src/lib/lesson-topics.ts` | Hằng số: 15 chủ đề + map `phaseSlug/lessonSlug` → chủ đề. Không chạm DB. |
| `web/src/lib/lesson-topics.test.ts` | Cổng kiểm tra: mọi bài khớp đúng 1 chủ đề, slug không trùng. |
| `web/src/lib/learn-topics.ts` | Truy vấn DB, ghép với taxonomy → dữ liệu cho 2 trang mới. |
| `web/src/lib/learn-topics.test.ts` | Test hàm thuần `buildLearnTopics` (không cần DB). |
| `web/src/app/(app)/learn/page.tsx` | Hub: lưới thẻ chủ đề, gom theo 4 nhóm. |
| `web/src/app/(app)/learn/chu-de/[topic]/page.tsx` | Chi tiết chủ đề: hero + danh sách bài. |
| `web/src/components/learn/TopicLessonList.tsx` | Danh sách bài trong một chủ đề, có bộ lọc trạng thái. |
| `web/src/components/learn/TopicLessonList.test.tsx` | Test cho trên. |
| `web/src/components/vocab/MatchBoard.test.tsx` | Chưa từng có — Task 3 tạo. |

**Sửa**

| File | Sửa gì |
|---|---|
| `web/src/components/vocab/games.ts` | Thêm `audioUrl` vào `MatchPair`; `buildMatchRound` + `buildMatchRounds` mang nó theo. |
| `web/src/components/vocab/MatchBoard.tsx:56` | Ghép đúng → `playWordAudio` thay `playSfx("correct")`. |
| `web/src/components/vocab/PracticeSession.tsx:220` | Chọn đúng → `playWordAudio`; chọn sai giữ `playSfx("wrong")`. |
| `web/src/app/(app)/dashboard/page.tsx` | Bỏ `LessonMap`, bỏ query `db.phase.findMany` nặng; giữ "Tiếp tục" + "Tuần này"; thêm link sang `/learn`. |
| `web/src/components/AppSidebar.tsx:6` | `href: "/dashboard"` → `"/learn"` cho mục "Lộ trình". |
| `web/src/components/MobileTabBar.tsx:18` | Như trên. |
| `web/src/components/LessonTabs.tsx:33-37` | Back-link `/dashboard` → `/learn`. |
| 5 file page có `if (state === "LOCKED") redirect("/dashboard")` | Xoá guard. |
| `CLAUDE.md`, `docs/architecture.md` | Ghi lại kiến trúc mới. |

**Xoá** (chỉ sau khi Task 8 xong và test xanh)

- `web/src/components/LessonMap.tsx`
- `web/src/components/PhasePillRow.tsx`
- `web/src/components/lesson-node.tsx`

Cả ba chỉ được dùng bởi nhau và bởi `dashboard/page.tsx` (đã verify bằng `grep -rln`). Không có test riêng cho chúng.

---

## RỦI RO — đọc hết trước khi gõ dòng code đầu tiên

### R1 — 🔴 CHẶN ĐƯỜNG: 5 guard `redirect("/dashboard")` sẽ làm trang mới vô dụng

Bỏ ổ khoá trên UI mà quên guard phía server thì **bấm bài nào chưa mở khoá cũng bị đá về `/dashboard`** — tính năng trông như hỏng hoàn toàn. Phải xoá đủ cả 5:

```
web/src/app/(app)/learn/[phase]/[lesson]/page.tsx:35-36
web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx:36-37
web/src/app/(app)/learn/[phase]/[lesson]/vocab/page.tsx:28-29
web/src/app/(app)/learn/[phase]/[lesson]/vocab/flashcards/page.tsx:29-30
web/src/app/(app)/learn/[phase]/[lesson]/vocab/play/page.tsx:31-32
```

Sau khi xoá, biến `states` ở các file đó có thể thành **không dùng nữa** → `eslint no-unused-vars` sẽ fail build. Xoá luôn cả lệnh gọi `getLessonStates` ở file nào không còn dùng tới nó. Task 8 lo việc này, có lệnh kiểm chứng cụ thể.

### R2 — 🔴 `SKIPPED` không phải "đã học"

Bài kiểm tra đầu vào ghi `status: "SKIPPED"` cho **mọi bài trước điểm bắt đầu** (`assignStartPoint`, `web/src/lib/progress.ts:114`). Người xếp vào Giai đoạn 3 sẽ có ~23 bài SKIPPED. Code cũ (`LessonMap.tsx:44`, `dashboard/page.tsx:54`) đếm `COMPLETED || SKIPPED` là "xong".

Nếu bê nguyên cách đếm đó sang trang mới, một người mới thi xếp lớp sẽ mở `/learn` và thấy **"Đã học 23/52 bài"** dù chưa học buổi nào. Ngược lại, nếu coi SKIPPED là "chưa học" thì thanh tiến độ tụt so với dashboard cũ.

**Quyết định:** SKIPPED là trạng thái **thứ tư, riêng biệt** — nhãn "Đã bỏ qua", chấm xám, **không** tính vào `learned`. Lý do: trang mới bỏ khoá nên "bỏ qua" giờ có nghĩa "bạn được xếp bắt đầu sau bài này, vẫn học lại được nếu muốn" — đúng tinh thần bỏ khoá. Thanh tiến độ chỉ đếm `COMPLETED`.

### R3 — 🟠 Va chạm route `/learn/chu-de/[topic]` vs `/learn/[phase]/[lesson]`

Cả hai đều khớp path 2 đoạn. Next.js ưu tiên **đoạn tĩnh** (`chu-de`) hơn đoạn động (`[phase]`), nên `/learn/chu-de/thi-dong-tu` sẽ vào đúng trang chủ đề. An toàn **với điều kiện** không phase nào có slug `chu-de` — đã verify: tất cả đều dạng `phase_N_*`.

Task 7 có một bước bắt buộc: mở cả `/learn/chu-de/thi-dong-tu` **và** `/learn/phase_1_foundation/lesson_01_simple_present` để chứng minh cả hai vẫn đúng.

### R4 — 🟠 Đổi `MatchPair` sẽ làm `games.test.ts` fail

`games.test.ts` (12.6 KB) có thể so sánh nguyên object `MatchPair` bằng `toEqual`. Thêm trường `audioUrl` sẽ phá những assertion đó. Đây là **fail mong đợi**, không phải bug — sửa test cho khớp, đừng bỏ trường.

Chạy `npx vitest run src/components/vocab/games.test.ts` ngay sau khi đổi type để thấy đúng chỗ hỏng.

### R5 — 🟠 `PracticeSession.test.tsx` mock `playSfx`, không mock `playWordAudio`

Test hiện có (`PracticeSession.test.tsx`) chạy trong jsdom, nơi `HTMLAudioElement.play()` **không tồn tại** → sẽ ném `TypeError: el.play is not a function` nếu không được nuốt. `word-audio.ts` phải bọc try/catch giống hệt `sfx.ts`, nếu không 9 test hiện có sẽ đỏ hết.

`ExerciseRunner.sfx.test.tsx` và `celebrate.test.ts` **không** bị ảnh hưởng — chúng chỉ đụng `playSfx`, mà `playSfx` vẫn còn nguyên cho câu sai và cho ExerciseRunner.

### R6 — 🟠 Nhịp 900ms có thể cắt ngang từ đang đọc

`AUTO_ADVANCE_MS = 900` ở `PracticeSession.tsx:29`. File phát âm dài ~700–1100ms, nên câu tiếp theo hiện ra trong lúc từ còn đang đọc.

**Quyết định: KHÔNG đổi 900ms.** Audio không bị dừng khi sang câu mới (không có cleanup nào gọi `pause`), nên từ vẫn đọc hết trên nền câu mới — giống Duolingo. Nâng lên 1500ms sẽ làm phiên chậm rõ rệt **và** buộc phải sửa `vi.advanceTimersByTime(1000)` ở 2 helper trong `PracticeSession.test.tsx`. Đổi ít, hỏng ít.

### R7 — 🟡 ~5 từ không có mp3

Kho có 2701 file cho ~2706 từ. Theo quyết định #4: không có `audioUrl` → **im lặng**, không quay lại ting. Người học sẽ thấy ghép đúng mà không nghe gì. Đây là hành vi đúng theo yêu cầu, và là động lực để sinh nốt audio còn thiếu (`cd web && npm run audio:vocab`).

### R8 — 🟡 Dashboard mất lộ trình → 2 nav link chết

`AppSidebar` và `MobileTabBar` đều gắn nhãn "Lộ trình" vào `/dashboard`. Đổi sang `/learn` mà quên một trong hai thì nav trên desktop và mobile trỏ hai nơi khác nhau. `LessonTabs` cũng có back-link "← Quay lại lộ trình học" → `/dashboard`.

Ba chỗ, sửa cùng một lúc trong Task 8. Có lệnh grep kiểm chứng.

### R9 — 🟡 Cache audio không giới hạn

`word-audio.ts` cache `HTMLAudioElement` theo `src`. Một phiên chạm tối đa ~40 từ nên không phải vấn đề thực tế; nhưng người dùng ở lại tab và chơi nhiều chủ đề liên tiếp có thể tích vài trăm element. Chấp nhận: mỗi element rỗng chỉ vài KB metadata, và cache biến mất khi reload. Không thêm LRU (YAGNI).

### R10 — 🟡 Emoji phải khác nhau giữa 15 chủ đề

Thẻ chủ đề nhận diện bằng emoji. Trùng emoji làm hai chủ đề khó phân biệt. Task 4 có test ép mọi emoji là duy nhất.

### R11 — 🟢 Không cần seed / migrate / rebuild giữa chừng

Taxonomy là hằng số TS, nằm trong `web/src/`, đã được `COPY web /app` sẵn. **Không** chạy `make seed-all` cho plan này — chạy vào là gánh nguyên bẫy `topicId` bị xoá đã ghi ở `CLAUDE.md`. Chỉ `make up` một lần ở Task 10 để build image mới.

### R12 — 🟢 Bỏ khoá không đụng luồng hoàn thành bài

`ExerciseRunner` vẫn ghi `LessonProgress` COMPLETED và mở khoá bài kế như cũ. Ta chỉ ngừng **hiển thị** và ngừng **cưỡng chế** khoá. Không sửa `progress.ts`, không sửa API. Bài kiểm tra đầu vào vẫn hoạt động, chỉ là kết quả của nó giờ đọc ra là "điểm được gợi ý bắt đầu" chứ không phải "rào chắn".

---

# GIAI ĐOẠN A — Âm thanh (Task 1-3)

Độc lập hoàn toàn với phần lộ trình. Ship trước vì nhỏ, rủi ro thấp, và người dùng cảm nhận ngay.

---

### Task 1: Module `playWordAudio`

**Files:**
- Create: `web/src/lib/audio/word-audio.ts`
- Test: `web/src/lib/audio/word-audio.test.ts`

**Interfaces:**
- Consumes: không gì (module nền).
- Produces:
  - `export function playWordAudio(src: string | null | undefined): void`
  - `export function __resetWordAudioForTests(): void`

- [ ] **Step 1: Viết test FAIL**

Tạo `web/src/lib/audio/word-audio.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playWordAudio, __resetWordAudioForTests } from "@/lib/audio/word-audio";

type FakeAudio = {
  src: string;
  currentTime: number;
  preload: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
};

let created: FakeAudio[] = [];

beforeEach(() => {
  created = [];
  __resetWordAudioForTests();
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      preload = "";
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
      constructor(src: string) {
        this.src = src;
        created.push(this as unknown as FakeAudio);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("phát file phát âm kèm query version", () => {
  playWordAudio("/audio/vocab/bread.mp3");

  expect(created).toHaveLength(1);
  expect(created[0].src).toBe("/audio/vocab/bread.mp3?v=2");
  expect(created[0].play).toHaveBeenCalledTimes(1);
});

test("dùng lại cùng một element khi phát lại đúng từ đó", () => {
  playWordAudio("/audio/vocab/bread.mp3");
  playWordAudio("/audio/vocab/bread.mp3");

  expect(created).toHaveLength(1);
  expect(created[0].play).toHaveBeenCalledTimes(2);
});

test("từ mới thì cắt ngang từ đang đọc dở", () => {
  playWordAudio("/audio/vocab/bread.mp3");
  playWordAudio("/audio/vocab/milk.mp3");

  expect(created).toHaveLength(2);
  expect(created[0].pause).toHaveBeenCalledTimes(1);
  expect(created[1].play).toHaveBeenCalledTimes(1);
});

test("src rỗng thì im lặng, không dựng Audio nào", () => {
  playWordAudio(null);
  playWordAudio(undefined);
  playWordAudio("");

  expect(created).toHaveLength(0);
});

test("nuốt lỗi khi trình duyệt chặn autoplay", () => {
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        throw new Error("blocked");
      }
    },
  );

  expect(() => playWordAudio("/audio/vocab/bread.mp3")).not.toThrow();
});
```

- [ ] **Step 2: Chạy test, xem nó FAIL**

```bash
cd web && npx vitest run src/lib/audio/word-audio.test.ts
```

Kỳ vọng: FAIL với `Failed to resolve import "@/lib/audio/word-audio"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `web/src/lib/audio/word-audio.ts`:

```ts
"use client";

/**
 * Phát file phát âm của MỘT từ tiếng Anh.
 *
 * Khác `playSfx`: đây không phải hiệu ứng thưởng/phạt mà là chính nội dung
 * học — trả lời đúng thì thứ đáng nghe là cách đọc của từ, không phải tiếng
 * "ting". Vì vậy nó cắt ngang file đang đọc dở: ghép nhanh sáu cặp phải nghe
 * ra sáu từ nối nhau, mỗi lần đều khớp cặp vừa bấm, chứ không phải một chồng
 * âm chồng lên nhau.
 *
 * Không bao giờ throw — jsdom không có `play()`, và trình duyệt có thể chặn
 * autoplay; cả hai đều không được làm hỏng luồng trả lời câu hỏi.
 */

/** Giữ ĐỒNG BỘ với `VOICE_VERSION` trong `PronounceButton.tsx`. Tăng mỗi khi
 * sinh lại toàn bộ `public/audio/vocab/` (ví dụ đổi giọng đọc): file tĩnh
 * của Next được cache 4 tiếng và không revalidate, tên file lại suy từ chữ
 * của từ nên không đổi được — query string là thứ duy nhất buộc tải lại. */
const VOICE_VERSION = 2;

/** Cache theo `src`: một phiên chạm tối đa vài chục từ, giữ lại để lần phát
 * thứ hai không phải tải lại file. */
const cache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

export function playWordAudio(src: string | null | undefined): void {
  if (!src) return;
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  try {
    if (current !== null) current.pause();

    let el = cache.get(src);
    if (!el) {
      el = new Audio(`${src}?v=${VOICE_VERSION}`);
      el.preload = "auto";
      cache.set(src, el);
    }

    current = el;
    el.currentTime = 0;
    void el.play()?.catch(() => {});
  } catch {
    /* fail silent */
  }
}

export function __resetWordAudioForTests(): void {
  cache.clear();
  current = null;
}
```

- [ ] **Step 4: Chạy test, xem nó PASS**

```bash
cd web && npx vitest run src/lib/audio/word-audio.test.ts
```

Kỳ vọng: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/audio/word-audio.ts web/src/lib/audio/word-audio.test.ts
git commit -m "feat(audio): thêm playWordAudio phát file phát âm, cắt ngang từ đang đọc"
```

---

### Task 2: `MatchPair` mang theo `audioUrl`

**Files:**
- Modify: `web/src/components/vocab/games.ts` (interface `MatchPair` ~135, `buildMatchRound` ~155, `buildMatchRounds` ~178)
- Test: `web/src/components/vocab/games.test.ts`

**Interfaces:**
- Consumes: `VocabWordLite` đã có `audioUrl: string | null`.
- Produces:
  ```ts
  export interface MatchPair {
    wordId: string;
    word: string;
    meaningVi: string;
    audioUrl: string | null;
  }
  ```
  `MatchRound` không đổi hình dạng (`pairs`/`left`/`right` vẫn là `MatchPair[]`).

- [ ] **Step 1: Viết test FAIL**

Thêm vào cuối `web/src/components/vocab/games.test.ts`:

```ts
test("buildMatchRound mang audioUrl theo từng cặp để bàn ghép đọc được từ", () => {
  const words = [
    { id: "w1", word: "bread", meaningVi: "bánh mì", audioUrl: "/audio/vocab/bread.mp3" },
    { id: "w2", word: "milk", meaningVi: "sữa", audioUrl: null },
  ];

  const round = buildMatchRound(words, () => 0);

  expect(round).not.toBeNull();
  const bread = round!.pairs.find((p) => p.wordId === "w1");
  const milk = round!.pairs.find((p) => p.wordId === "w2");
  expect(bread?.audioUrl).toBe("/audio/vocab/bread.mp3");
  expect(milk?.audioUrl).toBeNull();
});

test("buildMatchRounds cũng mang audioUrl theo", () => {
  const words = [
    { id: "w1", word: "bread", meaningVi: "bánh mì", audioUrl: "/audio/vocab/bread.mp3" },
    { id: "w2", word: "milk", meaningVi: "sữa", audioUrl: "/audio/vocab/milk.mp3" },
  ];

  const rounds = buildMatchRounds(words, 6, () => 0);

  expect(rounds).toHaveLength(1);
  expect(rounds[0].pairs.every((p) => p.audioUrl !== undefined)).toBe(true);
});
```

- [ ] **Step 2: Chạy test, xem nó FAIL**

```bash
cd web && npx vitest run src/components/vocab/games.test.ts
```

Kỳ vọng: 2 test mới FAIL với `expected undefined to be '/audio/vocab/bread.mp3'`.

- [ ] **Step 3: Sửa type và hai hàm build**

Trong `web/src/components/vocab/games.ts`, đổi interface:

```ts
export interface MatchPair {
  wordId: string;
  word: string;
  meaningVi: string;
  /** File phát âm của từ tiếng Anh; null khi chưa sinh. Bàn ghép cặp đọc từ
   * này lên mỗi khi ghép đúng, nên nó phải đi cùng cặp chứ không tra ngược
   * từ pool — MatchBoard không nhìn thấy pool. */
  audioUrl: string | null;
}
```

Trong `buildMatchRound`:

```ts
  const pairs: MatchPair[] = eligible.map((w) => ({
    wordId: w.id,
    word: w.word,
    meaningVi: w.meaningVi,
    audioUrl: w.audioUrl,
  }));
```

Trong `buildMatchRounds`, sửa y hệt khối `const pairs: MatchPair[] = chunk.map(...)`:

```ts
    const pairs: MatchPair[] = chunk.map((w) => ({
      wordId: w.id,
      word: w.word,
      meaningVi: w.meaningVi,
      audioUrl: w.audioUrl,
    }));
```

- [ ] **Step 4: Chạy test, xem nó PASS**

```bash
cd web && npx vitest run src/components/vocab/games.test.ts
```

Kỳ vọng: toàn bộ file PASS. **Nếu có test cũ đỏ vì `toEqual` so nguyên object `MatchPair`** — đó là R4, đã lường trước: thêm `audioUrl` vào object kỳ vọng trong test cũ, đừng bỏ trường mới.

- [ ] **Step 5: Kiểm tra type toàn dự án**

```bash
cd web && npx tsc --noEmit
```

Kỳ vọng: sạch. Nếu báo lỗi ở chỗ nào tự dựng `MatchPair` bằng tay, thêm `audioUrl` ở đó.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/vocab/games.ts web/src/components/vocab/games.test.ts
git commit -m "feat(vocab): MatchPair mang audioUrl để bàn ghép cặp đọc được từ"
```

---

### Task 3: Ghép/chọn đúng thì đọc từ, không kêu ting

**Files:**
- Modify: `web/src/components/vocab/MatchBoard.tsx:56` (bỏ `playSfx("correct")`), giữ nguyên dòng 74
- Modify: `web/src/components/vocab/PracticeSession.tsx:220` (`handleSelect`)
- Create: `web/src/components/vocab/MatchBoard.test.tsx`
- Test: `web/src/components/vocab/PracticeSession.test.tsx` (thêm 2 test)

**Interfaces:**
- Consumes: `playWordAudio(src: string | null | undefined): void` từ Task 1; `MatchPair.audioUrl` từ Task 2.
- Produces: không API mới.

- [ ] **Step 1: Viết test FAIL cho MatchBoard**

Tạo `web/src/components/vocab/MatchBoard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const { playWordAudio, playSfx } = vi.hoisted(() => ({
  playWordAudio: vi.fn(),
  playSfx: vi.fn(),
}));
vi.mock("@/lib/audio/word-audio", () => ({ playWordAudio }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));

import { MatchBoard } from "@/components/vocab/MatchBoard";
import type { MatchRound } from "@/components/vocab/games";

const pairs = [
  { wordId: "w1", word: "bread", meaningVi: "bánh mì", audioUrl: "/audio/vocab/bread.mp3" },
  { wordId: "w2", word: "milk", meaningVi: "sữa", audioUrl: null },
];
const round: MatchRound = { pairs, left: pairs, right: pairs };

function clickPair(word: string, meaning: string) {
  fireEvent.click(screen.getAllByTestId("match-left").find((e) => e.textContent === word)!);
  fireEvent.click(screen.getAllByTestId("match-right").find((e) => e.textContent === meaning)!);
}

beforeEach(() => {
  playWordAudio.mockClear();
  playSfx.mockClear();
});

test("ghép đúng thì đọc từ tiếng Anh, không kêu ting", () => {
  render(<MatchBoard round={round} onComplete={() => {}} />);

  clickPair("bread", "bánh mì");

  expect(playWordAudio).toHaveBeenCalledWith("/audio/vocab/bread.mp3");
  expect(playSfx).not.toHaveBeenCalledWith("correct");
});

test("từ chưa có mp3 thì im lặng, không quay lại tiếng ting", () => {
  render(<MatchBoard round={round} onComplete={() => {}} />);

  clickPair("milk", "sữa");

  expect(playWordAudio).toHaveBeenCalledWith(null);
  expect(playSfx).not.toHaveBeenCalledWith("correct");
});

test("ghép sai vẫn kêu tiếng báo sai — đó là báo lỗi, không phải phần thưởng", () => {
  render(<MatchBoard round={round} onComplete={() => {}} />);

  clickPair("bread", "sữa");

  expect(playSfx).toHaveBeenCalledWith("wrong");
  expect(playWordAudio).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Chạy test, xem nó FAIL**

```bash
cd web && npx vitest run src/components/vocab/MatchBoard.test.tsx
```

Kỳ vọng: 2 test đầu FAIL (`playWordAudio` chưa được gọi lần nào); test thứ ba PASS sẵn.

- [ ] **Step 3: Sửa MatchBoard**

Trong `web/src/components/vocab/MatchBoard.tsx`, đổi import:

```ts
import { playSfx } from "@/lib/audio/sfx";
import { playWordAudio } from "@/lib/audio/word-audio";
```

Trong `evaluate`, thay `playSfx("correct")` (dòng 56) bằng:

```ts
    if (leftId === rightId) {
      // Ghép đúng thì thứ đáng nghe là chính từ vừa ghép, không phải tiếng
      // "ting" — người học ghép sáu cặp là nghe được sáu lần phát âm.
      // `pairs` là nguồn chân lý của bàn (cột trái/phải chỉ là bản xáo).
      playWordAudio(round.pairs.find((p) => p.wordId === leftId)?.audioUrl ?? null);
```

Dòng 74 `playSfx("wrong")` **giữ nguyên**.

- [ ] **Step 4: Chạy test, xem nó PASS**

```bash
cd web && npx vitest run src/components/vocab/MatchBoard.test.tsx
```

Kỳ vọng: 3 passed.

- [ ] **Step 5: Viết test FAIL cho PracticeSession**

Ở đầu `web/src/components/vocab/PracticeSession.test.tsx`, ngay dưới dòng `import { afterEach, ... } from "vitest";`, chèn mock (phải đứng TRƯỚC import component):

```tsx
const { playWordAudio, playSfx } = vi.hoisted(() => ({
  playWordAudio: vi.fn(),
  playSfx: vi.fn(),
}));
vi.mock("@/lib/audio/word-audio", () => ({ playWordAudio }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));
```

Trong `beforeEach` hiện có, thêm hai dòng:

```tsx
  playWordAudio.mockClear();
  playSfx.mockClear();
```

Và đổi `makeWords` để có `audioUrl` thật (hiện đang là `null` cho mọi từ):

```tsx
function makeWords(n: number): VocabWordLite[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    word: `word${i}`,
    meaningVi: `nghĩa ${i}`,
    audioUrl: `/audio/vocab/word${i}.mp3`,
  }));
}
```

Thêm 2 test vào cuối file:

```tsx
test("chọn đúng câu trắc nghiệm thì đọc từ tiếng Anh, không kêu ting", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);
  solveMatchBoard();
  playWordAudio.mockClear();
  playSfx.mockClear();

  const index = currentPromptWordIndex();
  answerQuiz(true);

  expect(playWordAudio).toHaveBeenCalledWith(`/audio/vocab/word${index}.mp3`);
  expect(playSfx).not.toHaveBeenCalledWith("correct");
});

test("chọn sai vẫn kêu tiếng báo sai và không đọc từ", () => {
  render(<PracticeSession words={makeWords(6)} backHref="/vocab" linkComponent="a" />);
  solveMatchBoard();
  playWordAudio.mockClear();
  playSfx.mockClear();

  answerQuiz(false);

  expect(playSfx).toHaveBeenCalledWith("wrong");
  expect(playWordAudio).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Chạy test, xem nó FAIL**

```bash
cd web && npx vitest run src/components/vocab/PracticeSession.test.tsx
```

Kỳ vọng: test "chọn đúng..." FAIL vì `playWordAudio` chưa được gọi. 9 test cũ vẫn PASS.

- [ ] **Step 7: Sửa PracticeSession**

Trong `web/src/components/vocab/PracticeSession.tsx`, thêm import:

```ts
import { playWordAudio } from "@/lib/audio/word-audio";
```

Thay thân `handleSelect` (dòng ~214-224):

```ts
  function handleSelect(optionId: string) {
    if (selectedId !== null || rendered?.kind !== "quiz") return;
    setSelectedId(optionId);
    const correct = optionId === rendered.round.correctOptionId;
    // Phát ngay trong handler của cú bấm: Safari/iOS chỉ cho phát audio khi
    // còn trong ngữ cảnh user gesture.
    //
    // Đúng thì đọc chính từ tiếng Anh thay vì kêu "ting": phản hồi đó vừa
    // xác nhận vừa dạy cách đọc. Sai thì vẫn giữ tiếng báo lỗi — nó là cảnh
    // báo, và đọc từ lúc vừa chọn sai sẽ nghe như đang khen.
    if (correct) {
      playWordAudio(rendered.word?.audioUrl ?? null);
    } else {
      playSfx("wrong");
    }
    const next = correct ? streak + 1 : 0;
    setStreak(next);
    setBestStreak((b) => Math.max(b, next));
  }
```

- [ ] **Step 8: Chạy test, xem nó PASS**

```bash
cd web && npx vitest run src/components/vocab/PracticeSession.test.tsx src/components/vocab/MatchBoard.test.tsx
```

Kỳ vọng: 11 + 3 passed.

- [ ] **Step 9: Chạy toàn bộ test + lint + type**

```bash
cd web && npm test && npm run lint && npx tsc --noEmit
```

Kỳ vọng: tất cả xanh. `ExerciseRunner.sfx.test.tsx` và `celebrate.test.ts` vẫn phải PASS — `playSfx` không bị xoá, chỉ thôi được gọi cho trường hợp đúng ở phần từ vựng.

- [ ] **Step 10: Commit**

```bash
git add web/src/components/vocab/
git commit -m "feat(vocab): trả lời đúng thì đọc từ tiếng Anh thay vì kêu ting"
```

---

# GIAI ĐOẠN B — Taxonomy chủ đề bài học (Task 4-5)

---

### Task 4: Hằng số 15 chủ đề + cổng kiểm tra

**Files:**
- Create: `web/src/lib/lesson-topics.ts`
- Test: `web/src/lib/lesson-topics.test.ts`

**Interfaces:**
- Consumes: không gì.
- Produces:
  ```ts
  export type LessonTopicGroup = "CORE" | "ADVANCED" | "VOCAB" | "IELTS";
  export const LESSON_TOPIC_GROUP_LABELS: Record<LessonTopicGroup, string>;
  export const LESSON_TOPIC_GROUP_ORDER: readonly LessonTopicGroup[];
  export interface LessonTopicDef {
    slug: string; nameVi: string; nameEn: string; emoji: string;
    group: LessonTopicGroup; description: string;
    /** "<phaseSlug>/<lessonSlug>", theo thứ tự học đề xuất trong chủ đề. */
    lessonKeys: string[];
  }
  export const LESSON_TOPICS: readonly LessonTopicDef[];
  export function lessonKey(phaseSlug: string, lessonSlug: string): string;
  export function topicOfLesson(phaseSlug: string, lessonSlug: string): LessonTopicDef | null;
  ```

- [ ] **Step 1: Viết test FAIL**

Tạo `web/src/lib/lesson-topics.test.ts`:

```ts
import { expect, test } from "vitest";

import {
  LESSON_TOPICS,
  LESSON_TOPIC_GROUP_ORDER,
  lessonKey,
  topicOfLesson,
} from "@/lib/lesson-topics";

/** 52 bài có thật trong repo, chép từ `ls phase_*/lesson_*`. Test này là cổng
 * kiểm tra: thêm/xoá bài trong Markdown mà quên cập nhật taxonomy thì đỏ ở đây
 * chứ không phải người học phát hiện ra bài biến mất khỏi lộ trình. */
const ALL_LESSON_KEYS = [
  "phase_1_foundation/lesson_01_simple_present",
  "phase_1_foundation/lesson_02_present_continuous",
  "phase_1_foundation/lesson_03_simple_past",
  "phase_1_foundation/lesson_04_simple_future",
  "phase_1_foundation/lesson_05_present_perfect",
  "phase_1_foundation/lesson_06_nouns",
  "phase_1_foundation/lesson_07_pronouns",
  "phase_1_foundation/lesson_08_adjectives",
  "phase_1_foundation/lesson_09_adverbs",
  "phase_1_foundation/lesson_10_prepositions",
  "phase_1_foundation/lesson_11_sentence_structure",
  "phase_1_foundation/lesson_12_basic_comparisons",
  "phase_1_foundation/lesson_13_question_tags",
  "phase_2_elementary/lesson_01_past_continuous",
  "phase_2_elementary/lesson_02_past_perfect",
  "phase_2_elementary/lesson_03_future_perfect_continuous",
  "phase_2_elementary/lesson_04_subject_verb_agreement",
  "phase_2_elementary/lesson_05_articles",
  "phase_2_elementary/lesson_06_modal_verbs",
  "phase_2_elementary/lesson_07_question_formation",
  "phase_2_elementary/lesson_08_conjunctions",
  "phase_2_elementary/lesson_09_basic_phrasal_verbs",
  "phase_2_elementary/lesson_10_word_formation",
  "phase_3_intermediate/lesson_01_passive_voice",
  "phase_3_intermediate/lesson_02_conditionals_type1_2",
  "phase_3_intermediate/lesson_03_conditionals_type3_mixed",
  "phase_3_intermediate/lesson_04_relative_clauses",
  "phase_3_intermediate/lesson_05_reported_speech",
  "phase_3_intermediate/lesson_06_gerunds_infinitives",
  "phase_3_intermediate/lesson_07_advanced_phrasal_verbs",
  "phase_3_intermediate/lesson_08_collocations",
  "phase_3_intermediate/lesson_09_nominalization",
  "phase_3_intermediate/lesson_10_advanced_comparisons",
  "phase_3_intermediate/lesson_11_discourse_markers",
  "phase_3_intermediate/lesson_12_awl_introduction",
  "phase_4_advanced/lesson_01_inversion",
  "phase_4_advanced/lesson_02_cleft_sentences",
  "phase_4_advanced/lesson_03_participle_clauses",
  "phase_4_advanced/lesson_04_subjunctive_mood",
  "phase_4_advanced/lesson_05_advanced_passive",
  "phase_4_advanced/lesson_06_vocabulary_nuances",
  "phase_4_advanced/lesson_07_idioms_colloquialisms",
  "phase_4_advanced/lesson_08_cohesive_devices",
  "phase_4_advanced/lesson_09_academic_essay_writing",
  "phase_4_advanced/lesson_10_awl_mastery",
  "phase_5_ielts_prep/lesson_01_writing_task1_charts",
  "phase_5_ielts_prep/lesson_02_writing_task1_maps_processes",
  "phase_5_ielts_prep/lesson_03_writing_task2_opinion_essay",
  "phase_5_ielts_prep/lesson_04_writing_task2_discussion_essay",
  "phase_5_ielts_prep/lesson_05_reading_strategies",
  "phase_5_ielts_prep/lesson_06_speaking_part1_2",
  "phase_5_ielts_prep/lesson_07_speaking_part3",
];

test("mọi bài học đều thuộc đúng MỘT chủ đề", () => {
  const seen = new Map<string, string[]>();
  for (const topic of LESSON_TOPICS) {
    for (const key of topic.lessonKeys) {
      seen.set(key, [...(seen.get(key) ?? []), topic.slug]);
    }
  }

  const missing = ALL_LESSON_KEYS.filter((k) => !seen.has(k));
  const duplicated = [...seen.entries()].filter(([, slugs]) => slugs.length > 1);
  const unknown = [...seen.keys()].filter((k) => !ALL_LESSON_KEYS.includes(k));

  expect({ missing, duplicated, unknown }).toEqual({
    missing: [],
    duplicated: [],
    unknown: [],
  });
});

test("tổng số bài trong taxonomy đúng bằng 52", () => {
  const total = LESSON_TOPICS.reduce((sum, t) => sum + t.lessonKeys.length, 0);
  expect(total).toBe(52);
});

test("slug chủ đề không trùng nhau", () => {
  const slugs = LESSON_TOPICS.map((t) => t.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
});

test("emoji không trùng nhau — thẻ chủ đề nhận diện bằng emoji", () => {
  const emojis = LESSON_TOPICS.map((t) => t.emoji);
  expect(new Set(emojis).size).toBe(emojis.length);
});

test("mọi chủ đề thuộc một nhóm hợp lệ và không nhóm nào rỗng", () => {
  for (const topic of LESSON_TOPICS) {
    expect(LESSON_TOPIC_GROUP_ORDER).toContain(topic.group);
  }
  for (const group of LESSON_TOPIC_GROUP_ORDER) {
    expect(LESSON_TOPICS.some((t) => t.group === group)).toBe(true);
  }
});

test("topicOfLesson tra ngược được, và trả null cho bài lạ", () => {
  const topic = topicOfLesson("phase_1_foundation", "lesson_01_simple_present");
  expect(topic?.slug).toBe("thi-dong-tu");
  expect(topicOfLesson("phase_9_nope", "lesson_99_nope")).toBeNull();
});

test("lessonKey ghép đúng định dạng dùng trong lessonKeys", () => {
  expect(lessonKey("phase_1_foundation", "lesson_01_simple_present")).toBe(
    "phase_1_foundation/lesson_01_simple_present",
  );
});
```

- [ ] **Step 2: Chạy test, xem nó FAIL**

```bash
cd web && npx vitest run src/lib/lesson-topics.test.ts
```

Kỳ vọng: FAIL với `Failed to resolve import "@/lib/lesson-topics"`.

- [ ] **Step 3: Viết implementation**

Tạo `web/src/lib/lesson-topics.ts`:

```ts
/**
 * Taxonomy 52 bài học → 15 chủ đề, cho trang Lộ trình duyệt theo CHỦ ĐỀ thay
 * vì theo giai đoạn.
 *
 * Vì sao là hằng số TypeScript chứ không phải bảng trong DB như
 * `vocab_topics/`: bảng này chỉ 52 dòng và gần như không đổi (nó đổi khi và
 * chỉ khi có bài học mới), trong khi con đường TSV → seed → Postgres đã một
 * lần quét sạch `topicId` của cả kho từ vựng vì image thiếu file nguồn. Giữ
 * ở đây thì không có migration, không có bước seed, không có dòng COPY nào
 * để quên — và `lesson-topics.test.ts` là cổng kiểm tra chạy trong mọi lần
 * `npm test`.
 *
 * Thứ tự trong `lessonKeys` là thứ tự học ĐỀ XUẤT của chủ đề (dễ → khó),
 * không phải thứ tự giai đoạn. Ví dụ "Câu bị động" đi từ bài Giai đoạn 3 rồi
 * mới tới bài Giai đoạn 4.
 */

export type LessonTopicGroup = "CORE" | "ADVANCED" | "VOCAB" | "IELTS";

export const LESSON_TOPIC_GROUP_LABELS: Record<LessonTopicGroup, string> = {
  CORE: "Ngữ pháp nền tảng",
  ADVANCED: "Ngữ pháp nâng cao",
  VOCAB: "Từ vựng & diễn đạt",
  IELTS: "Kỹ năng IELTS",
};

export const LESSON_TOPIC_GROUP_ORDER: readonly LessonTopicGroup[] = [
  "CORE",
  "ADVANCED",
  "VOCAB",
  "IELTS",
];

export interface LessonTopicDef {
  slug: string;
  nameVi: string;
  nameEn: string;
  emoji: string;
  group: LessonTopicGroup;
  /** Một câu mô tả, hiện trên thẻ hub và dưới tên ở trang chi tiết. */
  description: string;
  /** "<phaseSlug>/<lessonSlug>", theo thứ tự học đề xuất trong chủ đề. */
  lessonKeys: string[];
}

export const LESSON_TOPICS: readonly LessonTopicDef[] = [
  {
    slug: "thi-dong-tu",
    nameVi: "Thì động từ",
    nameEn: "Verb tenses",
    emoji: "🕐",
    group: "CORE",
    description: "Tám thì cơ bản: hiện tại, quá khứ, tương lai và các dạng hoàn thành.",
    lessonKeys: [
      "phase_1_foundation/lesson_01_simple_present",
      "phase_1_foundation/lesson_02_present_continuous",
      "phase_1_foundation/lesson_03_simple_past",
      "phase_1_foundation/lesson_04_simple_future",
      "phase_1_foundation/lesson_05_present_perfect",
      "phase_2_elementary/lesson_01_past_continuous",
      "phase_2_elementary/lesson_02_past_perfect",
      "phase_2_elementary/lesson_03_future_perfect_continuous",
    ],
  },
  {
    slug: "tu-loai-mao-tu",
    nameVi: "Từ loại & mạo từ",
    nameEn: "Parts of speech & articles",
    emoji: "🔤",
    group: "CORE",
    description: "Danh từ, đại từ, tính từ, trạng từ, giới từ và a/an/the.",
    lessonKeys: [
      "phase_1_foundation/lesson_06_nouns",
      "phase_1_foundation/lesson_07_pronouns",
      "phase_1_foundation/lesson_08_adjectives",
      "phase_1_foundation/lesson_09_adverbs",
      "phase_1_foundation/lesson_10_prepositions",
      "phase_2_elementary/lesson_05_articles",
    ],
  },
  {
    slug: "cau-truc-cau",
    nameVi: "Cấu trúc câu & câu hỏi",
    nameEn: "Sentence structure & questions",
    emoji: "📐",
    group: "CORE",
    description: "Dựng câu đúng, hoà hợp chủ ngữ–động từ, đặt câu hỏi và nối câu.",
    lessonKeys: [
      "phase_1_foundation/lesson_11_sentence_structure",
      "phase_2_elementary/lesson_04_subject_verb_agreement",
      "phase_2_elementary/lesson_07_question_formation",
      "phase_1_foundation/lesson_13_question_tags",
      "phase_2_elementary/lesson_08_conjunctions",
    ],
  },
  {
    slug: "so-sanh",
    nameVi: "So sánh & đối chiếu",
    nameEn: "Comparisons",
    emoji: "⚖️",
    group: "CORE",
    description: "Từ so sánh hơn/nhất cơ bản tới các cấu trúc so sánh nâng cao.",
    lessonKeys: [
      "phase_1_foundation/lesson_12_basic_comparisons",
      "phase_3_intermediate/lesson_10_advanced_comparisons",
    ],
  },
  {
    slug: "menh-de",
    nameVi: "Mệnh đề & câu phức",
    nameEn: "Clauses",
    emoji: "🔗",
    group: "ADVANCED",
    description: "Mệnh đề quan hệ, câu tường thuật và mệnh đề phân từ.",
    lessonKeys: [
      "phase_3_intermediate/lesson_04_relative_clauses",
      "phase_3_intermediate/lesson_05_reported_speech",
      "phase_4_advanced/lesson_03_participle_clauses",
    ],
  },
  {
    slug: "dieu-kien-gia-dinh",
    nameVi: "Câu điều kiện & giả định",
    nameEn: "Conditionals & subjunctive",
    emoji: "🔮",
    group: "ADVANCED",
    description: "Ba loại câu điều kiện, câu điều kiện hỗn hợp và thức giả định.",
    lessonKeys: [
      "phase_3_intermediate/lesson_02_conditionals_type1_2",
      "phase_3_intermediate/lesson_03_conditionals_type3_mixed",
      "phase_4_advanced/lesson_04_subjunctive_mood",
    ],
  },
  {
    slug: "cau-bi-dong",
    nameVi: "Câu bị động",
    nameEn: "Passive voice",
    emoji: "🔄",
    group: "ADVANCED",
    description: "Từ bị động cơ bản tới bị động kép và bị động phi ngôi.",
    lessonKeys: [
      "phase_3_intermediate/lesson_01_passive_voice",
      "phase_4_advanced/lesson_05_advanced_passive",
    ],
  },
  {
    slug: "dang-dong-tu",
    nameVi: "Động từ khuyết thiếu & dạng động từ",
    nameEn: "Modals, gerunds & infinitives",
    emoji: "🎚️",
    group: "ADVANCED",
    description: "Can/must/should và cách chọn giữa V-ing với to-V.",
    lessonKeys: [
      "phase_2_elementary/lesson_06_modal_verbs",
      "phase_3_intermediate/lesson_06_gerunds_infinitives",
    ],
  },
  {
    slug: "nhan-manh",
    nameVi: "Cấu trúc nhấn mạnh",
    nameEn: "Emphatic structures",
    emoji: "✨",
    group: "ADVANCED",
    description: "Đảo ngữ và câu chẻ — hai công cụ nâng band Writing rõ rệt nhất.",
    lessonKeys: [
      "phase_4_advanced/lesson_01_inversion",
      "phase_4_advanced/lesson_02_cleft_sentences",
    ],
  },
  {
    slug: "cum-dong-tu-thanh-ngu",
    nameVi: "Cụm động từ & thành ngữ",
    nameEn: "Phrasal verbs & idioms",
    emoji: "💬",
    group: "VOCAB",
    description: "Phrasal verb cơ bản tới nâng cao, cùng thành ngữ và khẩu ngữ.",
    lessonKeys: [
      "phase_2_elementary/lesson_09_basic_phrasal_verbs",
      "phase_3_intermediate/lesson_07_advanced_phrasal_verbs",
      "phase_4_advanced/lesson_07_idioms_colloquialisms",
    ],
  },
  {
    slug: "xay-dung-von-tu",
    nameVi: "Xây dựng vốn từ",
    nameEn: "Vocabulary building",
    emoji: "📚",
    group: "VOCAB",
    description: "Họ từ, collocation, danh hoá, sắc thái nghĩa và Academic Word List.",
    lessonKeys: [
      "phase_2_elementary/lesson_10_word_formation",
      "phase_3_intermediate/lesson_08_collocations",
      "phase_3_intermediate/lesson_09_nominalization",
      "phase_4_advanced/lesson_06_vocabulary_nuances",
      "phase_3_intermediate/lesson_12_awl_introduction",
      "phase_4_advanced/lesson_10_awl_mastery",
    ],
  },
  {
    slug: "lien-ket-mach-van",
    nameVi: "Liên kết & mạch văn",
    nameEn: "Cohesion & discourse",
    emoji: "🧵",
    group: "VOCAB",
    description: "Từ nối và phương tiện liên kết để bài viết đọc liền mạch.",
    lessonKeys: [
      "phase_3_intermediate/lesson_11_discourse_markers",
      "phase_4_advanced/lesson_08_cohesive_devices",
    ],
  },
  {
    slug: "viet-hoc-thuat",
    nameVi: "Viết học thuật & IELTS Writing",
    nameEn: "Academic & IELTS writing",
    emoji: "📝",
    group: "IELTS",
    description: "Bố cục bài luận học thuật, Task 1 biểu đồ/bản đồ và Task 2.",
    lessonKeys: [
      "phase_4_advanced/lesson_09_academic_essay_writing",
      "phase_5_ielts_prep/lesson_01_writing_task1_charts",
      "phase_5_ielts_prep/lesson_02_writing_task1_maps_processes",
      "phase_5_ielts_prep/lesson_03_writing_task2_opinion_essay",
      "phase_5_ielts_prep/lesson_04_writing_task2_discussion_essay",
    ],
  },
  {
    slug: "ielts-reading",
    nameVi: "Chiến lược IELTS Reading",
    nameEn: "IELTS reading strategies",
    emoji: "📖",
    group: "IELTS",
    description: "Skimming, scanning và cách xử lý từng dạng câu hỏi Reading.",
    lessonKeys: ["phase_5_ielts_prep/lesson_05_reading_strategies"],
  },
  {
    slug: "ielts-speaking",
    nameVi: "IELTS Speaking",
    nameEn: "IELTS speaking",
    emoji: "🎤",
    group: "IELTS",
    description: "Part 1, 2 và 3 — cách triển khai ý và giữ độ trôi chảy.",
    lessonKeys: [
      "phase_5_ielts_prep/lesson_06_speaking_part1_2",
      "phase_5_ielts_prep/lesson_07_speaking_part3",
    ],
  },
];

export function lessonKey(phaseSlug: string, lessonSlug: string): string {
  return `${phaseSlug}/${lessonSlug}`;
}

/** Tra ngược một bài về chủ đề của nó. Trả `null` cho bài chưa được xếp —
 * `lesson-topics.test.ts` đảm bảo trường hợp đó không tồn tại trong repo,
 * nhưng nơi gọi vẫn phải chịu được `null` vì DB có thể đi trước Markdown. */
export function topicOfLesson(phaseSlug: string, lessonSlug: string): LessonTopicDef | null {
  const key = lessonKey(phaseSlug, lessonSlug);
  return LESSON_TOPICS.find((t) => t.lessonKeys.includes(key)) ?? null;
}
```

> ⚠️ **Hai con số dễ lẫn:** mảng `LESSON_TOPICS` có **15 phần tử** (15 chủ đề), tổng `lessonKeys` của chúng là **52** (52 bài). Nếu test "tổng số bài đúng bằng 52" đỏ, đếm lại `lessonKeys` từng chủ đề; test "mọi bài học đều thuộc đúng MỘT chủ đề" sẽ chỉ đích danh bài nào thiếu, bài nào bị xếp hai nơi.

- [ ] **Step 4: Chạy test, xem nó PASS**

```bash
cd web && npx vitest run src/lib/lesson-topics.test.ts
```

Kỳ vọng: 7 passed. Nếu `missing`/`duplicated` không rỗng, sửa `lessonKeys` cho tới khi rỗng — **không** sửa `ALL_LESSON_KEYS` trừ khi đã `ls phase_*/` xác nhận repo thực sự khác.

- [ ] **Step 5: Đối chiếu với thư mục thật**

```bash
cd /home/ncd/learnspaces/learning_english && \
  find phase_* -maxdepth 1 -type d -name 'lesson_*' | sed 's|^|"|; s|$|",|' | sort
```

So danh sách này với `ALL_LESSON_KEYS` trong test. Phải khớp 52/52.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/lesson-topics.ts web/src/lib/lesson-topics.test.ts
git commit -m "feat(learn): taxonomy 52 bài học thành 15 chủ đề, kèm cổng kiểm tra"
```

---

### Task 5: Lớp dữ liệu `learn-topics.ts`

**Files:**
- Create: `web/src/lib/learn-topics.ts`
- Test: `web/src/lib/learn-topics.test.ts`

**Interfaces:**
- Consumes: `LESSON_TOPICS`, `LessonTopicDef`, `LessonTopicGroup`, `lessonKey` (Task 4); `getLessonStates(userId): Promise<Map<string, LessonState>>` và `LessonState = "LOCKED" | "UNLOCKED" | "COMPLETED" | "SKIPPED"` từ `@/lib/progress`; `db` từ `@/lib/db`.
- Produces:
  ```ts
  export type LessonStatus4 = "done" | "learning" | "skipped" | "new";
  export interface TopicLesson {
    id: string; slug: string; phaseSlug: string; title: string;
    phaseTitle: string; phaseOrderIndex: number; orderIndex: number;
    wordCount: number; status: LessonStatus4; href: string;
  }
  export interface LearnTopicSummary {
    slug: string; nameVi: string; nameEn: string; emoji: string;
    group: LessonTopicGroup; description: string;
    total: number; done: number; learning: number;
  }
  export interface LearnTopicDetail extends LearnTopicSummary { lessons: TopicLesson[] }
  export interface LessonRow {
    id: string; slug: string; title: string; orderIndex: number;
    phaseSlug: string; phaseTitle: string; phaseOrderIndex: number; wordCount: number;
  }
  export function toLessonStatus(state: LessonState | undefined): LessonStatus4;
  export function buildLearnTopics(rows: LessonRow[], states: Map<string, LessonState>): LearnTopicDetail[];
  export async function getLearnTopics(userId: string): Promise<LearnTopicDetail[]>;
  export async function getLearnTopicDetail(slug: string, userId: string): Promise<LearnTopicDetail | null>;
  ```

- [ ] **Step 1: Viết test FAIL**

Tạo `web/src/lib/learn-topics.test.ts`:

```ts
import { expect, test } from "vitest";

import { buildLearnTopics, toLessonStatus, type LessonRow } from "@/lib/learn-topics";
import type { LessonState } from "@/lib/progress";

function row(phaseSlug: string, slug: string, id: string, orderIndex: number): LessonRow {
  return {
    id,
    slug,
    title: `Bài ${orderIndex}`,
    orderIndex,
    phaseSlug,
    phaseTitle: "Giai đoạn X",
    phaseOrderIndex: 1,
    wordCount: 10,
  };
}

const ROWS: LessonRow[] = [
  row("phase_3_intermediate", "lesson_01_passive_voice", "L1", 1),
  row("phase_4_advanced", "lesson_05_advanced_passive", "L2", 5),
];

test("SKIPPED là trạng thái riêng, KHÔNG phải đã học", () => {
  expect(toLessonStatus("COMPLETED")).toBe("done");
  expect(toLessonStatus("UNLOCKED")).toBe("learning");
  expect(toLessonStatus("SKIPPED")).toBe("skipped");
  expect(toLessonStatus("LOCKED")).toBe("new");
  expect(toLessonStatus(undefined)).toBe("new");
});

test("gom bài vào đúng chủ đề, theo thứ tự học của chủ đề chứ không theo giai đoạn", () => {
  const topics = buildLearnTopics(ROWS, new Map());
  const passive = topics.find((t) => t.slug === "cau-bi-dong");

  expect(passive).toBeDefined();
  expect(passive!.lessons.map((l) => l.id)).toEqual(["L1", "L2"]);
  expect(passive!.total).toBe(2);
});

test("chỉ COMPLETED được tính là đã học — bỏ qua không phải là học xong", () => {
  const states = new Map<string, LessonState>([
    ["L1", "COMPLETED"],
    ["L2", "SKIPPED"],
  ]);

  const passive = buildLearnTopics(ROWS, states).find((t) => t.slug === "cau-bi-dong")!;

  expect(passive.done).toBe(1);
  expect(passive.lessons.map((l) => l.status)).toEqual(["done", "skipped"]);
});

test("đếm riêng số bài đang học", () => {
  const states = new Map<string, LessonState>([["L1", "UNLOCKED"]]);

  const passive = buildLearnTopics(ROWS, states).find((t) => t.slug === "cau-bi-dong")!;

  expect(passive.learning).toBe(1);
  expect(passive.done).toBe(0);
});

test("href trỏ về đúng URL bài học cũ, không đổi đường dẫn", () => {
  const passive = buildLearnTopics(ROWS, new Map()).find((t) => t.slug === "cau-bi-dong")!;

  expect(passive.lessons[0].href).toBe(
    "/learn/phase_3_intermediate/lesson_01_passive_voice",
  );
});

test("trả về đủ 15 chủ đề kể cả khi DB chưa có bài nào", () => {
  const topics = buildLearnTopics([], new Map());

  expect(topics).toHaveLength(15);
  expect(topics.every((t) => t.total === 0)).toBe(true);
});

test("bài có trong DB nhưng chưa được xếp chủ đề thì bị bỏ qua, không làm sập", () => {
  const rows = [...ROWS, row("phase_9_unknown", "lesson_99_unknown", "L9", 99)];

  const topics = buildLearnTopics(rows, new Map());

  expect(topics.flatMap((t) => t.lessons).map((l) => l.id)).not.toContain("L9");
});
```

> ⚠️ Test `trả về đủ 15 chủ đề` dùng `toHaveLength(15)` vì mảng `LESSON_TOPICS` có **15 phần tử** (tiêu đề chủ đề, không phải số bài). Nếu Task 4 kết thúc với số khác, sửa con số ở đây cho khớp `LESSON_TOPICS.length` — đừng thêm chủ đề rỗng chỉ để cho tròn số.

- [ ] **Step 2: Chạy test, xem nó FAIL**

```bash
cd web && npx vitest run src/lib/learn-topics.test.ts
```

Kỳ vọng: FAIL với `Failed to resolve import "@/lib/learn-topics"`.

- [ ] **Step 3: Viết implementation**

Tạo `web/src/lib/learn-topics.ts`:

```ts
import { db } from "@/lib/db";
import { getLessonStates, type LessonState } from "@/lib/progress";
import {
  LESSON_TOPICS,
  lessonKey,
  type LessonTopicGroup,
} from "@/lib/lesson-topics";

/**
 * Ghép taxonomy chủ đề (hằng số) với bài học + tiến độ (DB) thành dữ liệu cho
 * trang Lộ trình mới.
 *
 * `buildLearnTopics` là hàm THUẦN, tách hẳn khỏi truy vấn, để phần logic dễ
 * sai nhất — gom nhóm và đếm tiến độ — test được mà không cần Postgres.
 */

/**
 * Bốn trạng thái hiển thị của một bài.
 *
 * `skipped` cố ý KHÔNG gộp vào `done`: bài kiểm tra đầu vào ghi SKIPPED cho
 * mọi bài trước điểm được xếp, nên gộp lại thì một người vừa thi xong đã thấy
 * "đã học 23/52 bài" dù chưa học buổi nào. Lộ trình mới không khoá bài, nên
 * "đã bỏ qua" đọc đúng nghĩa: bạn được xếp bắt đầu sau bài này, muốn học lại
 * vẫn vào được.
 */
export type LessonStatus4 = "done" | "learning" | "skipped" | "new";

export function toLessonStatus(state: LessonState | undefined): LessonStatus4 {
  if (state === "COMPLETED") return "done";
  if (state === "UNLOCKED") return "learning";
  if (state === "SKIPPED") return "skipped";
  return "new";
}

export interface TopicLesson {
  id: string;
  slug: string;
  phaseSlug: string;
  title: string;
  phaseTitle: string;
  phaseOrderIndex: number;
  orderIndex: number;
  wordCount: number;
  status: LessonStatus4;
  href: string;
}

export interface LearnTopicSummary {
  slug: string;
  nameVi: string;
  nameEn: string;
  emoji: string;
  group: LessonTopicGroup;
  description: string;
  total: number;
  done: number;
  learning: number;
}

export interface LearnTopicDetail extends LearnTopicSummary {
  lessons: TopicLesson[];
}

/** Hàng bài học phẳng lấy từ DB — hình dạng tối thiểu `buildLearnTopics` cần. */
export interface LessonRow {
  id: string;
  slug: string;
  title: string;
  orderIndex: number;
  phaseSlug: string;
  phaseTitle: string;
  phaseOrderIndex: number;
  wordCount: number;
}

export function buildLearnTopics(
  rows: LessonRow[],
  states: Map<string, LessonState>,
): LearnTopicDetail[] {
  const byKey = new Map(rows.map((r) => [lessonKey(r.phaseSlug, r.slug), r]));

  return LESSON_TOPICS.map((topic) => {
    const lessons: TopicLesson[] = [];
    // Duyệt theo `lessonKeys` chứ không theo `rows`: thứ tự học trong một chủ
    // đề do taxonomy quyết định (dễ → khó), không phải thứ tự giai đoạn.
    for (const key of topic.lessonKeys) {
      const row = byKey.get(key);
      // Bài có trong taxonomy mà chưa có trong DB (chưa seed) thì bỏ qua —
      // trang vẫn dựng được, chỉ là chủ đề đó ít bài hơn.
      if (row === undefined) continue;
      lessons.push({
        id: row.id,
        slug: row.slug,
        phaseSlug: row.phaseSlug,
        title: row.title,
        phaseTitle: row.phaseTitle,
        phaseOrderIndex: row.phaseOrderIndex,
        orderIndex: row.orderIndex,
        wordCount: row.wordCount,
        status: toLessonStatus(states.get(row.id)),
        href: `/learn/${row.phaseSlug}/${row.slug}`,
      });
    }

    return {
      slug: topic.slug,
      nameVi: topic.nameVi,
      nameEn: topic.nameEn,
      emoji: topic.emoji,
      group: topic.group,
      description: topic.description,
      total: lessons.length,
      done: lessons.filter((l) => l.status === "done").length,
      learning: lessons.filter((l) => l.status === "learning").length,
      lessons,
    };
  });
}

async function fetchLessonRows(): Promise<LessonRow[]> {
  const lessons = await db.lesson.findMany({
    orderBy: [{ phase: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      orderIndex: true,
      phase: { select: { slug: true, title: true, orderIndex: true } },
      _count: { select: { words: true } },
    },
  });

  return lessons.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    orderIndex: l.orderIndex,
    phaseSlug: l.phase.slug,
    phaseTitle: l.phase.title,
    phaseOrderIndex: l.phase.orderIndex,
    wordCount: l._count.words,
  }));
}

export async function getLearnTopics(userId: string): Promise<LearnTopicDetail[]> {
  const [rows, states] = await Promise.all([fetchLessonRows(), getLessonStates(userId)]);
  return buildLearnTopics(rows, states);
}

export async function getLearnTopicDetail(
  slug: string,
  userId: string,
): Promise<LearnTopicDetail | null> {
  const topics = await getLearnTopics(userId);
  return topics.find((t) => t.slug === slug) ?? null;
}
```

- [ ] **Step 4: Chạy test, xem nó PASS**

```bash
cd web && npx vitest run src/lib/learn-topics.test.ts
```

Kỳ vọng: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/learn-topics.ts web/src/lib/learn-topics.test.ts
git commit -m "feat(learn): lớp dữ liệu gom bài học theo chủ đề, tách SKIPPED khỏi đã học"
```

---

# GIAI ĐOẠN C — Giao diện (Task 6-9)

Trước khi viết Task 6/7, **đọc lại hai file mẫu**:
`web/src/app/(app)/vocab/page.tsx` và `web/src/app/(app)/vocab/[topic]/page.tsx`.
Đây chính là bản thiết kế người dùng đã duyệt và yêu cầu làm giống.

---

### Task 6: Trang hub `/learn`

**Files:**
- Create: `web/src/app/(app)/learn/page.tsx`

**Interfaces:**
- Consumes: `getLearnTopics(userId)`, `LearnTopicSummary` (Task 5); `LESSON_TOPIC_GROUP_LABELS`, `LESSON_TOPIC_GROUP_ORDER` (Task 4); `getSessionUser()` từ `@/lib/auth/session`; `EmptyState` từ `@/components/EmptyState`; `cn` từ `@/lib/utils`.
- Produces: route `/learn`.

- [ ] **Step 1: Viết trang**

Tạo `web/src/app/(app)/learn/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { getLearnTopics, type LearnTopicDetail } from "@/lib/learn-topics";
import {
  LESSON_TOPIC_GROUP_LABELS,
  LESSON_TOPIC_GROUP_ORDER,
} from "@/lib/lesson-topics";
import { EmptyState } from "@/components/EmptyState";

/** Nền nhạt riêng cho từng nhóm, để bốn khu phân biệt được ngay từ xa —
 * cùng thủ pháp với lưới chủ đề ở trang Từ vựng. */
const GROUP_TINT = {
  CORE: "bg-primary/8 text-primary",
  ADVANCED: "bg-accent/10 text-accent",
  VOCAB: "bg-streak-bg text-streak-foreground",
  IELTS: "bg-success-bg text-success",
} as const;

function TopicCard({ topic }: { topic: LearnTopicDetail }) {
  const percent = topic.total === 0 ? 0 : Math.round((topic.done / topic.total) * 100);

  if (topic.total === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-4 opacity-60">
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl grayscale">{topic.emoji}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Sắp có
          </span>
        </div>
        <p className="text-sm font-semibold leading-tight">{topic.nameVi}</p>
      </div>
    );
  }

  return (
    <Link
      href={`/learn/chu-de/${topic.slug}`}
      data-testid="learn-topic-card"
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-xl text-2xl",
            GROUP_TINT[topic.group],
          )}
        >
          {topic.emoji}
        </span>
        <span className="text-caption font-semibold text-muted-foreground">
          {topic.done}/{topic.total}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold leading-tight">{topic.nameVi}</p>
        <p className="line-clamp-2 text-caption text-muted-foreground">{topic.description}</p>
      </div>

      {topic.learning > 0 && (
        <span className="w-fit rounded-full bg-streak-bg px-2 py-0.5 text-[11px] font-bold text-streak-foreground">
          Đang học {topic.learning}
        </span>
      )}

      <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </Link>
  );
}

/**
 * Lộ trình học duyệt theo CHỦ ĐỀ, không theo giai đoạn.
 *
 * Giai đoạn 1–5 là thứ tự soạn nội dung, không phải cách người học nghĩ về
 * tiếng Anh: ai muốn ôn câu bị động phải nhớ nó nằm ở Giai đoạn 3 và 4 rồi
 * mở hai chỗ. Ở đây "Câu bị động" là một chủ đề, hai bài nằm cạnh nhau.
 *
 * Không còn ổ khoá: mọi bài đều vào được, thẻ chỉ cho biết đã học tới đâu.
 */
export default async function LearnHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const topics = await getLearnTopics(user.id);
  const totalLessons = topics.reduce((sum, t) => sum + t.total, 0);
  const doneLessons = topics.reduce((sum, t) => sum + t.done, 0);
  const percent = totalLessons === 0 ? 0 : Math.round((doneLessons / totalLessons) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-h1 font-extrabold">Lộ trình</h1>
      <p className="mb-5 text-body text-muted-foreground">
        Chọn một chủ đề để học bài giảng và làm bài tập.
      </p>

      {totalLessons > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold">
              Đã học {doneLessons}
              <span className="font-normal text-muted-foreground">/{totalLessons} bài</span>
            </span>
            <span className="text-caption text-muted-foreground">{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {totalLessons === 0 ? (
        <EmptyState
          icon="🌱"
          title="Chưa có gì ở đây"
          description="Nội dung bài học chưa được nạp vào hệ thống."
          linkComponent={Link}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {LESSON_TOPIC_GROUP_ORDER.map((group) => {
            const inGroup = topics.filter((t) => t.group === group);
            if (inGroup.length === 0) return null;
            const groupLessons = inGroup.reduce((sum, t) => sum + t.total, 0);
            return (
              <section key={group}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-h2 font-bold">{LESSON_TOPIC_GROUP_LABELS[group]}</h2>
                  <span className="text-caption text-muted-foreground">
                    {inGroup.length} chủ đề · {groupLessons} bài
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {inGroup.map((topic) => (
                    <TopicCard key={topic.slug} topic={topic} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Kiểm tra type + lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Kỳ vọng: sạch. Nếu `bg-success-bg` hoặc `text-streak-foreground` không tồn tại, kiểm tra token có thật trong `src/app/globals.css` và thay bằng token gần nhất — **không** hardcode hex.

- [ ] **Step 3: Chạy dev server và mở trang**

```bash
cd web && npm run dev
```

Mở `http://localhost:3000/learn`. Kỳ vọng: 4 khu, 15 thẻ chủ đề, tổng 52 bài, không thẻ nào "Sắp có".

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(app)/learn/page.tsx"
git commit -m "feat(learn): trang hub lộ trình theo 15 chủ đề bài học"
```

---

### Task 7: Trang chi tiết `/learn/chu-de/[topic]` + danh sách bài

**Files:**
- Create: `web/src/components/learn/TopicLessonList.tsx`
- Create: `web/src/components/learn/TopicLessonList.test.tsx`
- Create: `web/src/app/(app)/learn/chu-de/[topic]/page.tsx`

**Interfaces:**
- Consumes: `getLearnTopicDetail(slug, userId)`, `TopicLesson`, `LessonStatus4` (Task 5); `LESSON_TOPIC_GROUP_LABELS` (Task 4); `buttonVariants` từ `@/components/ui/button`.
- Produces: route `/learn/chu-de/[topic]`; component `TopicLessonList({ lessons }: { lessons: TopicLesson[]; linkComponent: React.ElementType })`.

- [ ] **Step 1: Viết test FAIL cho TopicLessonList**

Tạo `web/src/components/learn/TopicLessonList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { TopicLessonList } from "@/components/learn/TopicLessonList";
import type { TopicLesson } from "@/lib/learn-topics";

function lesson(id: string, title: string, status: TopicLesson["status"]): TopicLesson {
  return {
    id,
    slug: `lesson_0${id}_x`,
    phaseSlug: "phase_1_foundation",
    title,
    phaseTitle: "Giai đoạn 1: Nền tảng",
    phaseOrderIndex: 1,
    orderIndex: Number(id),
    wordCount: 12,
    status,
    href: `/learn/phase_1_foundation/lesson_0${id}_x`,
  };
}

const LESSONS = [
  lesson("1", "Thì hiện tại đơn", "done"),
  lesson("2", "Hiện tại tiếp diễn", "learning"),
  lesson("3", "Quá khứ đơn", "new"),
  lesson("4", "Tương lai đơn", "skipped"),
];

test("hiện mọi bài kèm link vào bài — không bài nào bị khoá", () => {
  render(<TopicLessonList lessons={LESSONS} linkComponent="a" />);

  const rows = screen.getAllByTestId("topic-lesson");
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.getAttribute("href")).toContain("/learn/phase_1_foundation/");
  }
});

test("bốn nhãn trạng thái riêng biệt, bỏ qua không phải đã học", () => {
  render(<TopicLessonList lessons={LESSONS} linkComponent="a" />);

  expect(screen.getByText("Đã học")).toBeTruthy();
  expect(screen.getByText("Đang học")).toBeTruthy();
  expect(screen.getByText("Chưa học")).toBeTruthy();
  expect(screen.getByText("Đã bỏ qua")).toBeTruthy();
});

test("lọc theo trạng thái thu hẹp danh sách", () => {
  render(<TopicLessonList lessons={LESSONS} linkComponent="a" />);

  const chip = screen.getAllByTestId("lesson-filter").find((b) => b.textContent?.includes("Đã học"))!;
  fireEvent.click(chip);

  expect(screen.getAllByTestId("topic-lesson")).toHaveLength(1);
  expect(screen.getByText("Thì hiện tại đơn")).toBeTruthy();
});

test("lọc ra rỗng thì báo rõ thay vì hiện danh sách trống", () => {
  render(<TopicLessonList lessons={[lesson("1", "Thì hiện tại đơn", "done")]} linkComponent="a" />);

  const chip = screen
    .getAllByTestId("lesson-filter")
    .find((b) => b.textContent?.includes("Chưa học"))!;
  fireEvent.click(chip);

  expect(screen.queryAllByTestId("topic-lesson")).toHaveLength(0);
  expect(screen.getByText("Chưa có bài nào ở trạng thái này.")).toBeTruthy();
});
```

- [ ] **Step 2: Chạy test, xem nó FAIL**

```bash
cd web && npx vitest run src/components/learn/TopicLessonList.test.tsx
```

Kỳ vọng: FAIL với `Failed to resolve import "@/components/learn/TopicLessonList"`.

- [ ] **Step 3: Viết component**

Tạo `web/src/components/learn/TopicLessonList.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { LessonStatus4, TopicLesson } from "@/lib/learn-topics";

type Filter = "all" | LessonStatus4;

const STATUS_META: Record<LessonStatus4, { label: string; dot: string; chip: string }> = {
  done: { label: "Đã học", dot: "bg-success", chip: "text-success" },
  learning: { label: "Đang học", dot: "bg-streak", chip: "text-streak-foreground" },
  skipped: { label: "Đã bỏ qua", dot: "bg-muted-foreground/60", chip: "text-muted-foreground" },
  new: { label: "Chưa học", dot: "bg-muted-foreground/30", chip: "text-muted-foreground" },
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "new", label: "Chưa học" },
  { value: "learning", label: "Đang học" },
  { value: "done", label: "Đã học" },
];

/**
 * Danh sách bài trong một chủ đề, kèm bộ lọc trạng thái.
 *
 * Không có ổ khoá: lộ trình theo chủ đề thì bài nào cũng vào được, chấm màu
 * chỉ cho biết đã học tới đâu. "Đã bỏ qua" là bài nằm trước điểm bài kiểm tra
 * đầu vào xếp cho bạn — vẫn học lại được, nên nó không tính vào tiến độ.
 *
 * Hàng lọc dùng lưới 4 cột chứ không phải hàng cuộn ngang: bốn nhãn tiếng
 * Việt kèm số đếm luôn tràn khỏi màn hình điện thoại.
 */
export function TopicLessonList({
  lessons,
  linkComponent: Link,
}: {
  lessons: TopicLesson[];
  /** Truyền `NextLink` trong app, `"a"` trong test/design. */
  linkComponent: React.ElementType;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const base: Record<Filter, number> = {
      all: lessons.length,
      done: 0,
      learning: 0,
      skipped: 0,
      new: 0,
    };
    for (const l of lessons) base[l.status] += 1;
    return base;
  }, [lessons]);

  const filtered = useMemo(
    () => lessons.filter((l) => filter === "all" || l.status === filter),
    [lessons, filter],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Danh sách bài</h2>
        <span className="text-caption text-muted-foreground">
          {filtered.length}
          {filtered.length !== lessons.length && `/${lessons.length}`} bài
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            data-testid="lesson-filter"
            onClick={() => setFilter(f.value)}
            className={cn(
              "flex min-h-9 items-center justify-center rounded-full border px-1 text-center text-[11px] font-semibold leading-tight transition-all",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {f.label} {counts[f.value]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-caption text-muted-foreground">
          Chưa có bài nào ở trạng thái này.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((l) => {
            const meta = STATUS_META[l.status];
            return (
              <li key={l.id}>
                <Link
                  href={l.href}
                  data-testid="topic-lesson"
                  className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", meta.dot)}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="truncate text-caption text-muted-foreground">
                      {l.phaseTitle}
                      {l.wordCount > 0 && <> · {l.wordCount} từ vựng</>}
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-[11px] font-semibold", meta.chip)}>
                    {meta.label}
                  </span>
                  <span className="shrink-0 text-muted-foreground" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Chạy test, xem nó PASS**

```bash
cd web && npx vitest run src/components/learn/TopicLessonList.test.tsx
```

Kỳ vọng: 4 passed.

- [ ] **Step 5: Viết trang chi tiết**

Tạo `web/src/app/(app)/learn/chu-de/[topic]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getLearnTopicDetail } from "@/lib/learn-topics";
import { LESSON_TOPIC_GROUP_LABELS } from "@/lib/lesson-topics";
import { TopicLessonList } from "@/components/learn/TopicLessonList";

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default async function LearnTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { topic: slug } = await params;
  const topic = await getLearnTopicDetail(slug, user.id);
  if (topic === null) notFound();

  const percent = topic.total === 0 ? 0 : Math.round((topic.done / topic.total) * 100);
  // Bài để "Tiếp tục": bài đang học đầu tiên, nếu không có thì bài chưa học
  // đầu tiên. Chủ đề học xong hết thì không hiện nút.
  const nextLesson =
    topic.lessons.find((l) => l.status === "learning") ??
    topic.lessons.find((l) => l.status === "new") ??
    null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/learn"
          aria-label="Quay lại danh sách chủ đề"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="truncate rounded-full bg-muted px-3 py-1.5 text-caption font-semibold text-muted-foreground">
          {LESSON_TOPIC_GROUP_LABELS[topic.group]}
        </span>
      </div>

      {/* Hero: danh tính chủ đề, tiến độ và lối vào bài kế gom trong một khối
          — cùng bố cục với trang chủ đề Từ vựng. */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-4 bg-primary p-5 text-primary-foreground">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl">
            {topic.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-h1 font-extrabold leading-tight">{topic.nameVi}</h1>
            <p className="line-clamp-2 text-caption text-primary-foreground/80">
              {topic.description}
            </p>
            <p className="mt-1 text-caption font-semibold text-primary-foreground/90">
              Đã học {topic.done}/{topic.total} bài
              {topic.learning > 0 && <> · đang học {topic.learning}</>}
            </p>
          </div>
          <div className="relative hidden size-16 shrink-0 sm:block">
            <svg viewBox="0 0 64 64" className="size-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="7"
                className="stroke-white/25"
              />
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                className="stroke-white"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {percent}%
            </span>
          </div>
        </div>

        {nextLesson !== null && (
          <div className="p-4">
            <Link
              href={nextLesson.href}
              className={cn(buttonVariants({ size: "lg" }), "w-full gap-2 text-base")}
            >
              ▶ {nextLesson.status === "learning" ? "Học tiếp" : "Bắt đầu"}: {nextLesson.title}
            </Link>
          </div>
        )}
      </section>

      {topic.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-muted-foreground">
          Chủ đề này chưa có bài nào.
        </p>
      ) : (
        <TopicLessonList lessons={topic.lessons} linkComponent={Link} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Kiểm tra type + lint + chạy toàn bộ test**

```bash
cd web && npx tsc --noEmit && npm run lint && npm test
```

Kỳ vọng: tất cả xanh.

- [ ] **Step 7: Chứng minh route KHÔNG va chạm (R3)**

Với `npm run dev` đang chạy, mở lần lượt:

```
http://localhost:3000/learn/chu-de/cau-bi-dong
http://localhost:3000/learn/phase_1_foundation/lesson_01_simple_present
```

Kỳ vọng: URL đầu ra trang chủ đề "Câu bị động" với 2 bài; URL sau ra trang bài giảng như cũ. **Nếu URL đầu ra trang bài giảng** thì đoạn tĩnh không thắng — đổi tên thư mục route thành `topics` và cập nhật mọi `href` tương ứng.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/learn/ "web/src/app/(app)/learn/chu-de/"
git commit -m "feat(learn): trang chi tiết chủ đề với hero, vòng tiến độ và danh sách bài"
```

---

### Task 8: Bỏ khoá, chuyển hướng điều hướng, dọn dashboard

**Files:**
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx:33-36`
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx:34-37`
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/page.tsx:26-29`
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/flashcards/page.tsx:27-30`
- Modify: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/play/page.tsx:29-32`
- Modify: `web/src/components/AppSidebar.tsx:6`
- Modify: `web/src/components/MobileTabBar.tsx:18`
- Modify: `web/src/components/LessonTabs.tsx:33-37`
- Modify: `web/src/app/(app)/dashboard/page.tsx`
- Delete: `web/src/components/LessonMap.tsx`, `web/src/components/PhasePillRow.tsx`, `web/src/components/lesson-node.tsx`

**Interfaces:**
- Consumes: route `/learn` (Task 6).
- Produces: không API mới.

- [ ] **Step 1: Xoá 5 guard LOCKED**

Ở mỗi file trong danh sách 5 file trên, xoá hai dòng:

```ts
  const state = states.get(lesson.id) ?? "LOCKED";
  if (state === "LOCKED") redirect("/dashboard");
```

Rồi xoá luôn `const states = await getLessonStates(user.id);` (hoặc phần tử `getLessonStates` trong `Promise.all`) và import `getLessonStates` **nếu file đó không còn dùng `states` ở chỗ nào khác**. Kiểm tra bằng:

```bash
cd web && grep -n "states" "src/app/(app)/learn/[phase]/[lesson]/page.tsx"
```

Nếu `redirect` cũng không còn chỗ dùng nào khác trong file, xoá cả import `redirect` (nhiều file vẫn dùng nó cho `if (!user) redirect("/login")` — giữ lại ở những file đó).

- [ ] **Step 2: Xác nhận không còn guard nào**

```bash
cd web && grep -rn 'state === "LOCKED"' src/app/
```

Kỳ vọng: **không có kết quả nào**.

- [ ] **Step 3: Đổi 3 link điều hướng**

`web/src/components/AppSidebar.tsx` dòng 6 và `web/src/components/MobileTabBar.tsx` dòng 18:

```ts
  { href: "/learn", label: "Lộ trình", icon: Home },
```

`web/src/components/LessonTabs.tsx` dòng ~33:

```tsx
      <Link
        href="/learn"
        className="mb-4 block w-fit text-caption text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Quay lại lộ trình học
      </Link>
```

- [ ] **Step 4: Xác nhận không còn link "Lộ trình" nào trỏ /dashboard**

```bash
cd web && grep -rn '"/dashboard"' src/components/ src/app/
```

Kỳ vọng: chỉ còn những chỗ hợp lệ (ví dụ redirect sau đăng nhập/onboarding). Không còn dòng nào gắn nhãn "Lộ trình".

- [ ] **Step 5: Dọn dashboard**

Trong `web/src/app/(app)/dashboard/page.tsx`:
1. Xoá import `LessonMap`.
2. Đổi query `db.phase.findMany` — vẫn cần để tìm `nextUp`, nhưng bỏ `_count: { select: { words: true } }` khỏi `select` **chỉ khi** không còn dùng; thẻ "Tiếp tục" đang in `{nextUp.lesson._count.words} từ vựng`, nên **giữ nguyên** query.
3. Xoá khối render lộ trình (dòng ~155-166) và thay bằng một thẻ dẫn sang `/learn`:

```tsx
        {phases.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="Chưa có gì ở đây"
            description="Nội dung bài học chưa được nạp vào hệ thống."
            linkComponent={Link}
          />
        ) : (
          // Lộ trình đầy đủ đã chuyển sang `/learn` (duyệt theo chủ đề).
          // Dashboard giữ vai trò "hôm nay học gì", không lặp lại cả bản đồ.
          <Link
            href="/learn"
            className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span>
              <span className="block font-semibold">Xem lộ trình theo chủ đề</span>
              <span className="block text-caption text-muted-foreground">
                {totalDone}/{totalLessons} bài đã hoàn thành
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        )}
```

4. Xoá dòng `<h3 className="mb-2 text-body font-bold lg:hidden">Lộ trình</h3>`.

> Lưu ý: `totalDone` ở dashboard vẫn đếm `COMPLETED || SKIPPED` (mã cũ). Sửa thành chỉ `COMPLETED` cho khớp với `/learn` (R2), nếu không hai trang sẽ hiện hai con số khác nhau cho cùng một thứ:
> ```tsx
>       phase.lessons.filter((lesson) => states.get(lesson.id) === "COMPLETED").length,
> ```

- [ ] **Step 6: Xoá 3 component chết**

```bash
cd web && rm src/components/LessonMap.tsx src/components/PhasePillRow.tsx src/components/lesson-node.tsx
```

Xác nhận không còn ai tham chiếu:

```bash
cd web && grep -rn "LessonMap\|PhasePillRow\|LessonNode\|lesson-node" src/
```

Kỳ vọng: **không có kết quả nào**.

- [ ] **Step 7: Dọn cache type của Next rồi kiểm tra**

`.next/types` giữ lại type của route đã xoá và sẽ làm `tsc` báo lỗi ma.

```bash
cd web && rm -rf .next/types && npx tsc --noEmit && npm run lint && npm test
```

Kỳ vọng: tất cả xanh. Cảnh báo `no-img-element` ở `QuestionCard.tsx` là lỗi cũ, không liên quan.

- [ ] **Step 8: Commit**

```bash
git add -A web/src
git commit -m "feat(learn): bỏ khoá bài, chuyển Lộ trình sang /learn, dọn LessonMap"
```

---

### Task 9: Kiểm chứng bằng Playwright trên bản dựng thật

**Files:** không sửa file nào; đây là cổng nghiệm thu.

**Interfaces:**
- Consumes: mọi thứ từ Task 1-8.
- Produces: bằng chứng, không phải code.

- [ ] **Step 1: Dựng lại và chạy stack**

```bash
cd /home/ncd/learnspaces/learning_english && make up
```

**KHÔNG chạy `make seed-all`** (R11). Chờ container `web` healthy:

```bash
docker compose ps
```

- [ ] **Step 2: Kiểm tra âm thanh phần luyện tập từ vựng**

Dùng Playwright MCP, viewport 430×900. Mở một chủ đề có nhiều từ (ví dụ `/vocab/food-drink`), bấm "▶ Luyện tập".

Ở bàn ghép cặp, chèn script đếm số lần `Audio.play` được gọi và ghi lại URL:

```js
window.__played = [];
const OrigAudio = window.Audio;
window.Audio = function (src) { window.__played.push(src); return new OrigAudio(src); };
```

Ghép đúng 3 cặp, rồi đọc `window.__played`.

Kỳ vọng: 3 URL dạng `/audio/vocab/<word>.mp3?v=2`, khớp đúng 3 từ vừa ghép; **không** có `/sounds/correct.mp3`.

- [ ] **Step 3: Kiểm tra âm thanh câu trắc nghiệm**

Trả lời đúng một câu, đọc lại `window.__played`.

Kỳ vọng: thêm một URL `/audio/vocab/*.mp3`. Sau đó cố tình trả lời SAI một câu.

Kỳ vọng: lần này xuất hiện `/sounds/wrong.mp3?v=2` — tiếng báo sai vẫn còn.

- [ ] **Step 4: Kiểm tra trang `/learn`**

Mở `/learn`, chụp màn hình (bỏ tham số `filename` để xem được inline).

Kỳ vọng: 4 nhóm ("Ngữ pháp nền tảng", "Ngữ pháp nâng cao", "Từ vựng & diễn đạt", "Kỹ năng IELTS"), 15 thẻ, tổng 52 bài, không thẻ nào "Sắp có", **không có thanh cuộn ngang**.

Kiểm tra bằng script:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

Kỳ vọng: `true`.

- [ ] **Step 5: Kiểm tra trang chủ đề + chứng minh đã bỏ khoá**

Mở `/learn/chu-de/cau-bi-dong`. Kỳ vọng: hero tím, emoji 🔄, vòng tiến độ, 2 bài.

Bấm vào bài **Giai đoạn 4** (bài lẽ ra bị khoá với người dùng mới). Kỳ vọng: **vào được trang bài giảng**, không bị đá về `/dashboard`. Đây là bằng chứng R1 đã xử lý xong.

- [ ] **Step 6: Kiểm tra bộ lọc và điều hướng**

Trên `/learn/chu-de/thi-dong-tu` (8 bài), bấm chip "Chưa học". Kỳ vọng: danh sách thu hẹp, dòng đếm đổi thành dạng `n/8 bài`.

Bấm mục "Lộ trình" trên thanh nav dưới cùng. Kỳ vọng: về `/learn`, không phải `/dashboard`.

Vào một bài, bấm "← Quay lại lộ trình học". Kỳ vọng: về `/learn`.

- [ ] **Step 7: Kiểm tra dashboard**

Mở `/dashboard`. Kỳ vọng: lời chào, thẻ "Tiếp tục", thẻ "Xem lộ trình theo chủ đề", thẻ "Tuần này". **Không** còn 5 hàng giai đoạn.

- [ ] **Step 8: Ghi lại kết quả**

Chép các con số quan sát được (số thẻ, số bài, URL audio bắt được) vào phần mô tả commit ở Task 10.

---

### Task 10: Cập nhật tài liệu

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Sửa `CLAUDE.md`**

Trong mục "Layout", sau đoạn `vocab_topics/`, thêm:

```markdown
- Chủ đề **bài học** (khác chủ đề từ vựng) không có file nguồn: taxonomy 52
  bài → 15 chủ đề nằm trong `web/src/lib/lesson-topics.ts` dưới dạng hằng số
  TypeScript, có `lesson-topics.test.ts` làm cổng kiểm tra. Thêm/xoá thư mục
  `lesson_*` thì phải cập nhật cả hai file, nếu không `npm test` sẽ đỏ.
```

Trong "Hard rules", thêm:

```markdown
- **Lộ trình không còn khoá bài.** `/learn` duyệt theo chủ đề, mọi bài đều vào
  được; `LessonProgress` vẫn ghi như cũ nhưng chỉ dùng để HIỂN THỊ tiến độ.
  Đừng thêm lại `if (state === "LOCKED") redirect(...)` vào các trang dưới
  `learn/[phase]/[lesson]/` — có năm chỗ như vậy đã bị xoá có chủ đích.
- **`SKIPPED` không phải "đã học".** Bài kiểm tra đầu vào ghi SKIPPED cho mọi
  bài trước điểm được xếp; gộp nó vào tiến độ thì người vừa thi xong đã thấy
  "đã học 23/52 bài". Thanh tiến độ chỉ đếm `COMPLETED`.
```

Trong mục "Âm thanh", thêm:

```markdown
Trả lời ĐÚNG ở phần luyện tập từ vựng phát **file phát âm của chính từ đó**
(`playWordAudio` trong `web/src/lib/audio/word-audio.ts`), không phải SFX
"correct" — phản hồi đó vừa xác nhận vừa dạy cách đọc. Trả lời SAI vẫn dùng
`playSfx("wrong")`. Từ chưa có `audioUrl` thì im lặng, không quay lại tiếng
ting. `VOICE_VERSION` trong `word-audio.ts` phải khớp với `PronounceButton.tsx`.
```

- [ ] **Step 2: Sửa `docs/architecture.md`**

Cập nhật bảng route:

```markdown
| `/learn` | Hub lộ trình: 15 chủ đề bài học, gom theo 4 nhóm |
| `/learn/chu-de/[topic]` | Chi tiết chủ đề: hero + danh sách bài, có bộ lọc trạng thái |
| `/learn/[phase]/[lesson]` | Bài giảng (URL giữ nguyên từ trước khi đổi sang chủ đề) |
| `/dashboard` | "Hôm nay học gì": thẻ Tiếp tục + thống kê tuần + link sang `/learn` |
```

Thêm mục mới:

```markdown
## Lộ trình duyệt theo chủ đề, không theo giai đoạn

Giai đoạn 1–5 là thứ tự soạn nội dung, không phải cách người học nghĩ về tiếng
Anh: muốn ôn câu bị động phải nhớ nó nằm ở Giai đoạn 3 và 4 rồi mở hai chỗ.
`web/src/lib/lesson-topics.ts` gom 52 bài thành 15 chủ đề; `learn-topics.ts`
ghép taxonomy đó với `Lesson` + `LessonProgress` thành dữ liệu cho hai trang.

Taxonomy là hằng số TypeScript chứ không phải bảng DB như `vocab_topics/`: nó
chỉ 52 dòng, gần như không đổi, và con đường TSV → seed → Postgres đã một lần
quét sạch `topicId` của cả kho từ vựng vì image thiếu file nguồn. Ở dạng hằng
số thì không có migration, không bước seed, không dòng COPY nào để quên.

Đi kèm là bỏ khoá bài: `Phase.orderIndex` vẫn quyết định thứ tự mở khoá trong
`progress.ts`, nhưng UI không còn cưỡng chế nó — một chủ đề trải trên nhiều
giai đoạn thì nửa mở nửa khoá là vô nghĩa với người học.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/architecture.md
git commit -m "docs: ghi lại lộ trình theo chủ đề, bỏ khoá bài và phát âm thay SFX"
```

---

## Tự rà soát (đã chạy khi viết plan)

**1. Phủ hết yêu cầu người dùng?**

| Yêu cầu | Task |
|---|---|
| Dựng lại file plan trước khi execute | Chính file này |
| Lộ trình theo chủ đề/tên bài thay vì giai đoạn | Task 4, 5, 6, 7, 8 |
| Giữ ví dụ trong bài giảng + exercise tương ứng | Không đụng `learn/[phase]/[lesson]/**`, chỉ xoá guard LOCKED (Task 8 Step 1). URL không đổi. |
| Thiết kế chuyên nghiệp, đẹp như trang Từ vựng | Task 6, 7 bám sát `vocab/page.tsx` + `vocab/[topic]/page.tsx`; kiểm chứng bằng Playwright ở Task 9 |
| Ghép cặp đúng → đọc từ tiếng Anh | Task 2, 3 |
| Trắc nghiệm đúng → đọc từ tiếng Anh, bỏ ting | Task 3 |
| Check hết rủi ro, đưa vào plan | Mục **RỦI RO** R1–R12 |

**2. Quét placeholder:** không có "TBD"/"TODO"/"tương tự Task N". Mọi bước có code đều kèm khối code đầy đủ.

**3. Nhất quán kiểu:** `LessonStatus4` dùng ở `learn-topics.ts` (Task 5) và `TopicLessonList.tsx` (Task 7) cùng bốn giá trị `done|learning|skipped|new`. `TopicLesson` được định nghĩa ở Task 5 và tiêu thụ nguyên vẹn ở Task 7. `MatchPair.audioUrl` định nghĩa ở Task 2, dùng ở Task 3. `playWordAudio(src: string | null | undefined)` định nghĩa ở Task 1, gọi ở Task 3 tại hai chỗ, cả hai đều truyền `?? null`.

**4. Điểm cần chú ý khi execute:**
- Task 4 Step 3 có ghi chú về việc `LESSON_TOPICS.length` là **15**, còn tổng số bài là **52**. Hai test khác nhau, đừng lẫn.
- Task 5 test `toHaveLength(15)` phải khớp với `LESSON_TOPICS.length` thực tế sau Task 4.
