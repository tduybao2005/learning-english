# English Learning Web App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **On execution start:** copy this plan into the repo at `docs/superpowers/plans/2026-07-02-english-learning-web-app.md` (user asked for a repo-visible .md plan file).

**Goal:** Build a public web app (Vietnamese UI) that serves the existing Markdown English curriculum: email-OTP auth, learning-path selection + placement test (reading/writing/listening), sequential lesson unlocking, question-by-question exercise runner with retry-until-correct, Duolingo-style vocabulary games, IELTS practice test browser, and TTS-generated listening audio.

**Architecture:** Single Next.js 15 (App Router) full-stack codebase in `web/`, Postgres on Neon via Prisma, deployed on Vercel. Curriculum Markdown is parsed offline by a seed pipeline into structured DB rows (lectures stored as markdown text; exercises parsed into typed questions + answer variants). All answer checking happens server-side against the DB — answer keys never reach the browser. AI wrong-answer explanations are **explicitly deferred**: a pluggable `Explainer` interface + nullable DB/UI slots are built now; the user's future self-hosted serverless fine-tuned model plugs in later via one env var.

**Tech Stack:** Next.js 15 + React 19 + TypeScript 5, Tailwind v4 + shadcn/ui, Prisma 6 + Neon Postgres, `jose` (JWT session cookie), Resend (OTP email), `zod`, `react-markdown` + `remark-gfm`, `vitest`, `tsx` (seed scripts), Python `edge-tts` + `pydub` (listening audio pipeline).

## Global Constraints

- **UI language: Vietnamese** (labels, buttons, feedback); English content stays English. Mirrors the curriculum's bilingual style.
- **Deploy target: Vercel + Neon free tier + Resend free tier** from day 1. `DATABASE_URL` = Neon pooled string; `DIRECT_URL` = direct string (migrations/seed only).
- **Answer keys never sent to the client.** Exercise page fetches prompts/options only; checking is a server API.
- **AI explanation is DEFERRED.** Build `NullExplainer` + `explanation` nullable columns + `<ExplanationSlot>` UI now; no model calls. (See "Deferred Work" at the bottom.)
- **Curriculum files are read-only.** The seed pipeline reads `phase_*/`, `ielts_practice_tests/`; it never edits them.
- **Sessions:** stateless `jose` HS256 JWT in httpOnly cookie, 30-day expiry. Only `jose` in `middleware.ts` (Edge runtime — no Prisma/nodemailer there).
- **Listening audio:** generated locally by `edge-tts` (pinned version), mp3s committed to `web/public/audio/listening/` — regeneration never on the deploy path.
- **Seeding runs locally** against `DIRECT_URL` (repo markdown isn't on Vercel).
- New code lives entirely under `web/`; repo root stays a content repo.

## Context

The repo is a complete bilingual English curriculum: 5 phases (`phase_1_foundation` … `phase_5_ielts_prep`, ~54 lessons, each with `lecture.md` + `vocabulary.md` (~60 words in tables) + `exercise.md` with an embedded `## ANSWER KEY (ĐÁP ÁN)`), per-phase exams, and 30 IELTS practice tests (`reading.md`/`writing.md`/`speaking.md`/`answer_key.md`; no listening content exists). There is **no web code anywhere** — only Quarto PDF rendering.

The user wants (from `plan_build_web.md` + clarifications):
1. Email-OTP register/login (Gmail → code → done), persistent per-user progress.
2. Path selection (target IELTS band or CEFR level) then a placement test (reading + writing + listening) to refine the start point.
3. Sequential lectures; each lesson's exercise must be completed to unlock the next.
4. Exercise runner: one question at a time, must answer correctly to advance, wrong answers show feedback (AI explanation later), exercises repeatable with clean-slate redo.
5. Vocabulary section with flashcards + games (Duolingo-like).
6. Beautiful UI, good system.

Clarified decisions: Next.js full-stack; Vercel + Resend + Neon from day 1; listening content authored fresh + TTS mp3 audio playable on the web; AI explanations deferred until the user hosts their own fine-tuned model serverless (design the plug-in point now).

Known data quirks the parser must survive (verified by inspection):
- `phase_1_foundation/lesson_01_simple_present/exercise.md` has a **student's answers filled into the blanks** (`______cooks______`) — parse answers from the ANSWER KEY section only; normalize filled-blank runs back to `______`.
- Section headings vary (`## SECTION A: FILL IN THE BLANK (Điền vào chỗ trống)` vs `## SECTION A: Gerund or Infinitive? (20 items)`); question numbering is **global and continuous** across sections; answer-key heading text varies; alternatives use `/` (`finishes / ends`); MCQ keys look like `16. B (is having)`; error-correction keys look like `34. "is know" → **knows** (…)`; some key sections say `Gợi ý đáp án` (open-ended).

---

## File Structure

```
web/
  package.json, next.config.ts, tsconfig.json, vitest.config.ts
  prisma/schema.prisma
  scripts/
    seed/ingest.ts              # orchestrator: walks repo, upserts everything
    seed/parse-lesson.ts        # phase/lesson dir walk + lecture.md
    seed/parse-vocab.ts         # vocabulary.md tables -> word rows
    seed/parse-exercise.ts      # exercise.md -> sections/questions/variants (pure)
    seed/parse-listening.ts     # content/listening/*.md -> listening sets
    seed/validate.ts            # parse-coverage report, --strict exits 1
    seed/overrides.json         # lessonSlug.sectionLabel -> kind escape hatch
    tts/generate_audio.py       # edge-tts transcript -> mp3
  content/listening/            # authored listening scripts (source of truth)
  public/audio/listening/       # generated mp3s (committed)
  src/
    middleware.ts               # session guard (jose only)
    lib/db.ts                   # Prisma singleton
    lib/auth/{otp.ts, session.ts, email.ts}
    lib/grading/{normalize.ts, match.ts}   # pure, shared seed+runtime
    lib/ai/grader.ts            # Explainer/EssayGrader interfaces + NullExplainer
    lib/band.ts                 # raw score -> band, band -> start lesson
    app/(auth)/login/...        # login + verify pages
    app/onboarding/{path,placement}/...
    app/(app)/{dashboard,learn,ielts,listening,settings}/...
    app/api/...                 # route handlers (see route map)
    components/...              # ExerciseRunner, AudioPlayer, vocab games, ui/
  tests/ (or colocated *.test.ts)  # vitest unit tests
```

Route map:

| Route | Type | Notes |
|---|---|---|
| `/login`, `/login/verify` | client | email → OTP form |
| `/onboarding/path` | client | IELTS band (5.0–8.0 step 0.5) or CEFR A1–C1 |
| `/onboarding/placement` | client wizard | listening → reading → writing |
| `/onboarding/placement/result` | RSC | band + assigned start lesson |
| `/dashboard` | RSC | phase→lesson map with lock/done/skipped states |
| `/learn/[phase]/[lesson]` | RSC | lecture (rendered markdown), tabs to vocab/exercise |
| `/learn/[phase]/[lesson]/vocab` + `/(flashcards\|quiz\|match)` | client | games |
| `/learn/[phase]/[lesson]/exercise` | RSC → client `ExerciseRunner` | prompts only, no keys |
| `/ielts`, `/ielts/[n]` | RSC | test browser, collapsible answer key |
| `/listening`, `/listening/[slug]` | client | audio player + question form |
| `/settings` | client | change goal, logout |

API: `POST /api/auth/{request-otp,verify-otp,logout}` · `POST /api/onboarding/path` · `POST /api/placement/{submit-section,complete}` · `POST /api/exercises/[id]/attempts` · `POST /api/attempts/[id]/answers` · `POST /api/vocab/review`.

---

### Task 1: Scaffold, Neon, Vercel — hello page live

**Files:**
- Create: `web/` via create-next-app (package.json, src/app/…)
- Create: `web/.env.local` (git-ignored), `web/.env.example`

**Interfaces:**
- Produces: running Next.js app in `web/`, deployed Vercel project, Neon DB with `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) env vars set locally and on Vercel.

- [ ] **Step 1: Scaffold the app**

```bash
cd /home/ncd/learnspaces/learning_english
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
cd web
npx shadcn@latest init -d
npm install prisma @prisma/client zod jose resend react-markdown remark-gfm
npm install -D vitest @vitest/coverage-v8 tsx
npx prisma init
```

- [ ] **Step 2: Add vitest config + npm scripts**

`web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node" },
});
```

In `web/package.json` scripts add:
```json
"test": "vitest run",
"seed": "tsx scripts/seed/ingest.ts",
"seed:validate": "tsx scripts/seed/validate.ts",
"postinstall": "prisma generate"
```

- [ ] **Step 3: Create Neon project + set env**

User action (needs browser): create free Neon project `learning-english`. Then fill `web/.env.local` and `web/.env.example` keys:
```
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"   # pooled
DIRECT_URL="postgresql://.../neondb?sslmode=require"               # direct
SESSION_SECRET="<openssl rand -hex 32>"
RESEND_API_KEY="re_..."
OTP_DEV_ECHO="false"
```

- [ ] **Step 4: Verify local run**

Run: `npm run dev` → open http://localhost:3000, default page renders. Run: `npm run test` → "no tests" passes cleanly.

- [ ] **Step 5: Deploy to Vercel**

```bash
npx vercel link   # root directory = web/
npx vercel env add DATABASE_URL ... (all 4 vars)
npx vercel deploy --prod
```
Expected: deployed URL renders the default page.

- [ ] **Step 6: Commit**

```bash
git add web/ && git commit -m "feat(web): scaffold Next.js app with Tailwind, shadcn/ui, Prisma, vitest"
```

---

### Task 2: Prisma schema + migration

**Files:**
- Create: `web/prisma/schema.prisma`
- Create: `web/src/lib/db.ts`

**Interfaces:**
- Produces: full DB schema (models below) and `db` Prisma singleton — every later task consumes these exact model/field names.

- [ ] **Step 1: Write the schema**

`web/prisma/schema.prisma` — complete content:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
generator client { provider = "prisma-client-js" }

enum GoalType { IELTS CEFR }
enum QuestionKind { FILL_BLANK MULTIPLE_CHOICE TRANSFORMATION ERROR_CORRECTION TRANSLATION OPEN_WRITING }
enum LessonStatus { UNLOCKED COMPLETED SKIPPED }        // LOCKED = no row
enum MatchType { EXACT VARIANT FUZZY MANUAL AI }
enum ListeningKind { PLACEMENT PRACTICE }

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  goalType      GoalType?
  goalValue     String?   // "6.5" | "B2"
  placementBand Float?
  createdAt     DateTime  @default(now())
  lessonProgress    LessonProgress[]
  vocabProgress     VocabProgress[]
  attempts          ExerciseAttempt[]
  placementAttempts PlacementAttempt[]
}

model OtpCode {
  id         String    @id @default(cuid())
  email      String
  codeHash   String    // sha256(code + SESSION_SECRET)
  expiresAt  DateTime  // now + 10 min
  attempts   Int       @default(0)  // max 5
  consumedAt DateTime?
  createdAt  DateTime  @default(now())
  @@index([email, createdAt])
}

model Phase {
  id         String   @id @default(cuid())
  slug       String   @unique  // "phase_1_foundation"
  orderIndex Int
  title      String
  cefrLabel  String   // "A1→A2"
  lessons    Lesson[]
}

model Lesson {
  id          String  @id @default(cuid())
  phaseId     String
  phase       Phase   @relation(fields: [phaseId], references: [id])
  slug        String  // "lesson_01_simple_present"
  orderIndex  Int
  title       String
  lectureMd   String  @db.Text
  sourceDir   String
  contentHash String  // sha256 of the 3 source files → idempotent seed
  words       VocabWord[]
  exercise    Exercise?
  progress    LessonProgress[]
  @@unique([phaseId, slug])
}

model VocabWord {
  id         String @id @default(cuid())
  lessonId   String
  lesson     Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  groupName  String
  word       String
  ipa        String
  meaningVi  String
  exampleEn  String
  orderIndex Int
  progress   VocabProgress[]
  @@unique([lessonId, orderIndex])
}

model Exercise {
  id       String  @id @default(cuid())
  lessonId String  @unique
  lesson   Lesson  @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  title    String
  sections Section[]
  attempts ExerciseAttempt[]
}

// Shared question container for exercises, listening sets, placement tests.
// Exactly one FK is set (app-level invariant).
model Section {
  id              String  @id @default(cuid())
  exerciseId      String?
  exercise        Exercise? @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  listeningSetId  String?
  listeningSet    ListeningSet? @relation(fields: [listeningSetId], references: [id], onDelete: Cascade)
  placementTestId String?
  placementTest   PlacementTest? @relation(fields: [placementTestId], references: [id], onDelete: Cascade)
  label        String   // "A"
  title        String
  kind         QuestionKind
  instructions String?  @db.Text
  orderIndex   Int
  questions    Question[]
}

model Question {
  id          String  @id @default(cuid())
  sectionId   String
  section     Section @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  number      Int     // global number within the exercise (matches answer key)
  prompt      String  @db.Text
  options     Json?   // [{label:"A",text:"has"},...]
  answerRaw   String  @db.Text  // raw key line, audit + future AI context
  keyNote     String? @db.Text
  isOpenEnded Boolean @default(false)
  variants    AnswerVariant[]
  @@unique([sectionId, number])
}

model AnswerVariant {
  id         String   @id @default(cuid())
  questionId String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  text       String   // display form
  normalized String   // matching form
  @@index([questionId])
}

model ExerciseAttempt {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  exerciseId  String
  exercise    Exercise  @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  currentQuestionNumber Int @default(1)
  answers     AttemptAnswer[]
  @@index([userId, exerciseId])
}

model AttemptAnswer {
  id               String  @id @default(cuid())
  attemptId        String
  attempt          ExerciseAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  questionId       String
  answerText       String  @db.Text
  isCorrect        Boolean
  matchType        MatchType?
  tries            Int     @default(1)
  wrongAnswers     Json?   // history of wrong submissions this run
  explanation      String? @db.Text  // FUTURE: AI explanation
  explanationModel String?           // FUTURE: model version
  updatedAt        DateTime @updatedAt
  @@unique([attemptId, questionId])
}

model LessonProgress {
  userId      String
  user        User   @relation(fields: [userId], references: [id])
  lessonId    String
  lesson      Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  status      LessonStatus
  unlockedAt  DateTime @default(now())
  completedAt DateTime?
  @@id([userId, lessonId])
}

model VocabProgress {
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  wordId         String
  word           VocabWord @relation(fields: [wordId], references: [id], onDelete: Cascade)
  box            Int       @default(0)  // Leitner 0..5; >=3 = learned
  lastReviewedAt DateTime  @default(now())
  @@id([userId, wordId])
}

model ListeningSet {
  id           String @id @default(cuid())
  slug         String @unique
  title        String
  kind         ListeningKind
  audioUrl     String        // "/audio/listening/placement_01.mp3"
  transcriptMd String @db.Text
  durationSec  Int?
  sections     Section[]
}

model PlacementTest {
  id              String @id @default(cuid())
  slug            String @unique  // "default"
  readingMd       String @db.Text
  writingPromptMd String @db.Text
  listeningSetId  String?
  bandTable       Json    // [{min:33,band:8.0},...] raw→band for reading & listening
  sections        Section[]
  attempts        PlacementAttempt[]
}

model PlacementAttempt {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  testId          String
  test            PlacementTest @relation(fields: [testId], references: [id])
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
  readingScore    Int?
  listeningScore  Int?
  band            Float?    // computed from reading+listening only (writing deferred)
  writingText     String?   @db.Text  // stored, ungraded for now
  writingBand     Float?    // FUTURE: AI
  writingFeedback String?   @db.Text  // FUTURE: AI
  answers         Json      // {questionId: {text, isCorrect}}
}

model IeltsTest {
  id          String  @id @default(cuid())
  number      Int     @unique  // 1..30
  readingMd   String  @db.Text
  writingMd   String  @db.Text
  speakingMd  String  @db.Text
  answerKeyMd String  @db.Text
  isComplete  Boolean @default(true)
}
```

- [ ] **Step 2: Prisma singleton**

`web/src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 3: Validate + migrate**

Run: `npx prisma validate` → expected: "schema is valid". Run: `npx prisma migrate dev --name init` → migration applies against Neon (uses `DIRECT_URL`).

- [ ] **Step 4: Commit**

```bash
git add web/prisma web/src/lib/db.ts && git commit -m "feat(web): full Prisma data model + Neon migration"
```

---

### Task 3: Lesson + vocabulary ingestion

**Files:**
- Create: `web/scripts/seed/parse-lesson.ts`, `web/scripts/seed/parse-vocab.ts`, `web/scripts/seed/ingest.ts`
- Test: `web/scripts/seed/parse-vocab.test.ts`, `web/scripts/seed/parse-lesson.test.ts`

**Interfaces:**
- Consumes: `db` from Task 2.
- Produces: `parseVocab(md: string): { groupName: string; word: string; ipa: string; meaningVi: string; exampleEn: string }[]`; `listLessons(repoRoot: string): { phaseSlug: string; phaseOrder: number; lessonSlug: string; lessonOrder: number; title: string; dir: string }[]`; CLI `npm run seed [-- --phase 1] [--dry-run]` that upserts Phase/Lesson/VocabWord (skips when `contentHash` unchanged). Exercise parsing is wired in by Task 4.

- [ ] **Step 1: Write failing vocab-parser test** (fixture = excerpt of `phase_1_foundation/lesson_01_simple_present/vocabulary.md`)

```ts
import { describe, it, expect } from "vitest";
import { parseVocab } from "./parse-vocab";

const fixture = `# VOCABULARY - BÀI 1
## PHẦN 1: BẢNG TỪ VỰNG (60 Words)
### Nhóm A: Động từ thói quen buổi sáng (Morning Routine Verbs)
| Word | Pronunciation /IPA/ | Nghĩa tiếng Việt | Ví dụ câu |
|------|---------------------|-----------------|-----------|
| wake up | /weɪk ʌp/ | thức dậy | I **wake up** at 6 am every morning. |
| get up | /ɡet ʌp/ | ngồi dậy, rời khỏi giường | She **gets up** immediately. |
### Nhóm B: Đi làm (Commute)
| Word | Pronunciation /IPA/ | Nghĩa tiếng Việt | Ví dụ câu |
|------|---------------------|-----------------|-----------|
| commute | /kəˈmjuːt/ | đi lại | He **commutes** by motorbike. |
`;

describe("parseVocab", () => {
  it("extracts rows grouped by Nhóm heading", () => {
    const words = parseVocab(fixture);
    expect(words).toHaveLength(3);
    expect(words[0]).toEqual({
      groupName: "Nhóm A: Động từ thói quen buổi sáng (Morning Routine Verbs)",
      word: "wake up", ipa: "/weɪk ʌp/", meaningVi: "thức dậy",
      exampleEn: "I **wake up** at 6 am every morning.",
    });
    expect(words[2].groupName).toContain("Nhóm B");
  });
  it("skips separator and header rows", () => {
    expect(parseVocab(fixture).some(w => w.word.includes("---"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm run test -- parse-vocab` → FAIL: cannot find `./parse-vocab`.

- [ ] **Step 3: Implement `parse-vocab.ts`**

```ts
export interface VocabRow { groupName: string; word: string; ipa: string; meaningVi: string; exampleEn: string }

export function parseVocab(md: string): VocabRow[] {
  const rows: VocabRow[] = [];
  let group = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^#{2,4}\s+(Nhóm.+|.*Group.+)$/i);
    if (h) { group = h[1].trim(); continue; }
    const cells = line.trim().match(/^\|(.+)\|$/)?.[1].split("|").map(c => c.trim());
    if (!cells || cells.length < 4) continue;
    if (/^-{2,}$/.test(cells[0]) || /^word$/i.test(cells[0])) continue;
    rows.push({ groupName: group, word: cells[0].replace(/\*\*/g, ""), ipa: cells[1], meaningVi: cells[2], exampleEn: cells[3] });
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm run test -- parse-vocab` → PASS.

- [ ] **Step 5: Write failing lesson-walker test** — temp-dir fixture with `phase_1_foundation/lesson_01_x/lecture.md` etc.; assert `listLessons` returns phase/lesson slugs, orders parsed from `lesson_(\d+)_` and `phase_(\d+)_`, and `title` = first `# ` heading of lecture.md. Run → FAIL.

- [ ] **Step 6: Implement `parse-lesson.ts`** — `readdirSync` for `phase_*` dirs (sorted), inside them `lesson_*` dirs; title from lecture.md first heading; phase titles/cefr from a small constant map:

```ts
export const PHASE_META: Record<string, { title: string; cefrLabel: string }> = {
  phase_1_foundation:   { title: "Giai đoạn 1: Nền tảng",      cefrLabel: "A1→A2" },
  phase_2_elementary:   { title: "Giai đoạn 2: Sơ cấp",        cefrLabel: "A2→B1" },
  phase_3_intermediate: { title: "Giai đoạn 3: Trung cấp",     cefrLabel: "B1→B2" },
  phase_4_advanced:     { title: "Giai đoạn 4: Nâng cao",      cefrLabel: "B2→C1" },
  phase_5_ielts_prep:   { title: "Giai đoạn 5: Luyện IELTS",   cefrLabel: "C1"    },
};
```
Run test → PASS.

- [ ] **Step 7: Implement `ingest.ts` orchestrator** — for each lesson: read the 3 files, `contentHash = sha256(lecture + vocab + exercise)`; if a Lesson row with same slug+hash exists → skip; else upsert Phase/Lesson, delete+recreate its VocabWords. `--dry-run` prints planned actions without writing. Uses `DIRECT_URL` via the normal Prisma client (env already routes it for scripts run with `dotenv -e .env.local` or Next's env loading via `tsx --env-file=.env.local`).

- [ ] **Step 8: Run against the real repo**

Run: `npm run seed` then a quick check script or `npx prisma studio`:
Expected: 5 Phases, ~54 Lessons, ~60 VocabWords per lesson, second run prints "skipped (unchanged)" for all lessons.

- [ ] **Step 9: Commit** — `git add web/scripts && git commit -m "feat(web): lesson + vocabulary ingestion pipeline"`

---

### Task 4: Exercise parser + validation report (highest-risk task)

**Files:**
- Create: `web/scripts/seed/parse-exercise.ts`, `web/scripts/seed/overrides.json`, `web/scripts/seed/validate.ts`
- Modify: `web/scripts/seed/ingest.ts` (wire exercises into the lesson upsert)
- Test: `web/scripts/seed/parse-exercise.test.ts` (fixtures: `phase_1_foundation/lesson_01_simple_present/exercise.md` — filled-blanks quirk; `phase_1_foundation/lesson_02_present_continuous/exercise.md` — canonical; `phase_3_intermediate/lesson_01_passive_voice/exercise.md` — worst-case heading variants)

**Interfaces:**
- Consumes: normalization from Task 8's `normalize()` — to avoid a cycle, implement `normalize()` in this task at `web/src/lib/grading/normalize.ts` (Task 8 extends the same file with `match()`).
- Produces:
```ts
export interface ParsedQuestion { number: number; prompt: string; options: {label: string; text: string}[] | null;
  answerRaw: string; keyNote: string | null; isOpenEnded: boolean; variants: {text: string; normalized: string}[] }
export interface ParsedSection { label: string; title: string; kind: QuestionKind; instructions: string | null; questions: ParsedQuestion[] }
export function parseExercise(md: string, overrides?: Record<string, QuestionKind>): { title: string; sections: ParsedSection[] }
```

- [ ] **Step 1: Write `normalize()` + its failing tests** (`web/src/lib/grading/normalize.ts`)

```ts
export function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase()
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ").trim()
    .replace(/[.,!?;:]+$/g, "").trim();
}
```
Tests: `normalize("  Doesn’t like. ") === "doesn't like"`, `normalize("Is / coming") === "is / coming"`. Run → FAIL → implement → PASS.

- [ ] **Step 2: Write failing parser tests against the 3 real fixture files** (read with `readFileSync` from repo root). Assertions:
  - lesson_01: 5 sections A–E; Section A kind `FILL_BLANK`; Q1 prompt contains `______` and does NOT contain `cooks` inside underscores; Q1 variants include `cooks`; Q2 (two blanks) has variant `opens / closes`; Section B kind `MULTIPLE_CHOICE`, Q16 options length 4, variant text `B`, keyNote `teaches`; Section D Q34 variants include `go`; Section E questions all `isOpenEnded === false`? — no: Section E key says "Sample Answers" → `isOpenEnded === true` with the sample stored in `answerRaw` and one fuzzy variant.
  - lesson_02: full section count matches its answer key count.
  - phase3 lesson_01: parser finds the answer-key boundary despite repeated bare `## SECTION A` headings after the divider; every parsed question has ≥1 variant or `isOpenEnded`.

Run: `npm run test -- parse-exercise` → FAIL.

- [ ] **Step 3: Implement `parse-exercise.ts`** per this strategy (pure function, no I/O):
  1. **Key boundary**: first heading matching `/^#{1,3}\s*.*\b(ANSWER KEY|ĐÁP ÁN)\b/im` splits body/key.
  2. **Body sections**: split on `/^##\s+SECTION\s+([A-Z])[:.]?\s*(.*)$/im`. Kind inference from title keywords (FILL/COMPLETE→FILL_BLANK; MULTIPLE CHOICE/CHOOSE + `- A)` present→MULTIPLE_CHOICE; TRANSFORM/REWRITE/COMBINE→TRANSFORMATION; ERROR/CORRECT→ERROR_CORRECTION; TRANSLAT/DỊCH→TRANSLATION; WRITING/FREE→OPEN_WRITING; fallback by options-presence). `overrides.json` `{ "lessonSlug.A": "FILL_BLANK" }` wins over inference.
  3. **Questions**: split section body on `/^\*{0,2}(\d+)[.)]\s/m` keeping global numbers. Normalize filled blanks: `prompt.replace(/_{2,}[^_\n]*_{2,}/g, "______")`. MCQ options from `/^\s*-\s*([A-D])\)\s*(.+)$/gm`.
  4. **Key sections**: split key on `/Section\s+([A-Z])/i` headings; answers from `/^(\d+)\.\s+(.*)$/gm`; join answers to questions by global number, cross-checked against section letter (mismatch → validation warning, number wins).
  5. **Variant extraction per kind**:
     - MCQ: `/^([A-D])\b\s*(?:\((.*)\))?/` → variant `A`–`D`; parenthetical → keyNote.
     - ERROR_CORRECTION: `/"(.+?)"\s*→\s*\**([^*(]+)\**/` → corrected token variant; full parenthetical sentence → second variant.
     - FILL_BLANK: count `______` in prompt; if ≥2 blanks, `/`-joined key = single variant; else split on `/` → variants. Expand parenthetical contractions: `does not (doesn't) go` → both forms.
     - TRANSFORMATION/TRANSLATION: expand `(...)`-alternates into separate variants; if the key's section header contains `Gợi ý` or `Sample` → `isOpenEnded = true`.
  6. Every variant stored with `normalized: normalize(text)`.

- [ ] **Step 4: Run tests until PASS** — iterate on regexes; do not weaken assertions.

- [ ] **Step 5: Implement `validate.ts`** — runs `parseExercise` over every lesson dir; prints per-lesson `sections / questions / questions-with-variants / unmatched key numbers`; `--strict` exits 1 if any lesson has unmatched answers or a section with 0 questions.

- [ ] **Step 6: Run the full-corpus validation**

Run: `npm run seed:validate -- --strict`
Expected: all ~54 lessons clean. For each failure, prefer fixing the parser; use `overrides.json` only for genuinely ambiguous section kinds. Budget iteration here — this is the known schedule risk.

- [ ] **Step 7: Wire into `ingest.ts`** — on lesson upsert (hash changed), delete + recreate the Exercise subtree (Sections/Questions/Variants; cascades wipe old attempts — acceptable pre-launch). Run `npm run seed`, spot-check in `prisma studio` that lesson_01 Q1 has variant `cooks`.

- [ ] **Step 8: Commit** — `git commit -m "feat(web): exercise.md parser + corpus validation (54 lessons clean)"`

---

### Task 5: Auth — OTP email + JWT session

**Files:**
- Create: `web/src/lib/auth/otp.ts`, `web/src/lib/auth/session.ts`, `web/src/lib/auth/email.ts`, `web/src/middleware.ts`
- Create: `web/src/app/api/auth/request-otp/route.ts`, `.../verify-otp/route.ts`, `.../logout/route.ts`
- Create: `web/src/app/(auth)/login/page.tsx`, `web/src/app/(auth)/login/verify/page.tsx`
- Test: `web/src/lib/auth/otp.test.ts`

**Interfaces:**
- Consumes: `db` (Task 2).
- Produces: `issueOtp(email): Promise<{code: string}>` (code returned only for send/dev-echo), `verifyOtp(email, code): Promise<{ok: true, userId: string, needsOnboarding: boolean} | {ok: false, reason: "expired"|"invalid"|"locked"|"rate_limited"}>`; `createSession(userId): Promise<void>` (sets cookie), `getSessionUser(): Promise<User | null>`, `destroySession()`. Middleware protects `/dashboard`, `/learn`, `/ielts`, `/listening`, `/settings`, `/onboarding`.

- [ ] **Step 1: Failing unit tests for OTP rules** (mock `db` with an in-memory stub or use a test transaction): correct code verifies once then is consumed; wrong code 5× → `locked`; expired (>10 min) → `expired`; 6th issue within an hour → `rate_limited`; issue within 60s of previous → `rate_limited`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `otp.ts`** — 6-digit code via `crypto.randomInt(100000, 999999)`, `codeHash = sha256(code + process.env.SESSION_SECRET)`, expiry `now + 10min`, checks per the tests. `email.ts`: Resend send with Vietnamese subject "Mã đăng nhập của bạn"; when `OTP_DEV_ECHO=true`, also `console.log` the code (dev convenience). `session.ts`: `jose` `SignJWT({sub})` HS256 30d, cookie `session` httpOnly/secure/sameSite=lax; `getSessionUser()` verifies + loads user.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Route handlers + middleware.** `request-otp`: zod `{email: z.string().email()}`, always 200 `{sent: true}` (no user enumeration; rate-limit failures also return 200). `verify-otp`: on success upsert User by email, set cookie, return `{needsOnboarding: user.goalType === null}`. `middleware.ts` (jose only): no/invalid cookie on protected matcher → redirect `/login`.
- [ ] **Step 6: Login pages** — `/login`: email input + "Gửi mã" button; `/login/verify?email=...`: 6-digit input, resend link with 60s countdown; shadcn `Card`/`Input`/`Button`, Vietnamese copy.
- [ ] **Step 7: E2E check** — `npm run dev`, request OTP to your real Gmail via Resend, complete login, confirm cookie set and `/dashboard` (placeholder) reachable; logout clears it. **Note:** on Resend free tier without a verified domain you can only send to your own address — verify a domain before inviting other users.
- [ ] **Step 8: Commit** — `git commit -m "feat(web): passwordless email OTP auth with JWT sessions"`

---

### Task 6: Onboarding — path selection

**Files:**
- Create: `web/src/app/onboarding/path/page.tsx`, `web/src/app/api/onboarding/path/route.ts`

**Interfaces:**
- Consumes: `getSessionUser()` (Task 5).
- Produces: `User.goalType/goalValue` persisted; after save → redirect `/onboarding/placement` (or `/dashboard` with "Làm bài kiểm tra đầu vào" prompt if they choose "Bỏ qua").

- [ ] **Step 1: Build the page** — two shadcn `Tabs`: "Mục tiêu IELTS" (band picker 5.0–8.0, step 0.5, radio chips) and "Cấp độ CEFR" (A1/A2/B1/B2/C1 cards with 1-line Vietnamese descriptions). Submit → `POST /api/onboarding/path` `{goalType, goalValue}` (zod: IELTS value ∈ {5.0,…,8.0}; CEFR ∈ {A1,A2,B1,B2,C1}).
- [ ] **Step 2: Verify** — pick a goal, check row in `prisma studio`, redirect lands on placement page (placeholder OK until Task 13).
- [ ] **Step 3: Commit** — `git commit -m "feat(web): onboarding learning-path selection"`

---

### Task 7: Dashboard + lecture page

**Files:**
- Create: `web/src/app/(app)/dashboard/page.tsx`, `web/src/app/(app)/learn/[phase]/[lesson]/page.tsx`
- Create: `web/src/components/LessonMap.tsx`, `web/src/components/MarkdownContent.tsx`, `web/src/lib/progress.ts`
- Test: `web/src/lib/progress.test.ts`

**Interfaces:**
- Consumes: Phases/Lessons (Task 3), `getSessionUser()` (Task 5).
- Produces: `getLessonStates(userId): Promise<Map<lessonId, "LOCKED"|"UNLOCKED"|"COMPLETED"|"SKIPPED">>` (no LessonProgress rows at all → only the globally-first lesson is UNLOCKED); `getNextLesson(lessonId): Promise<Lesson | null>` (orderIndex+1 in phase, else first lesson of next phase, else null). Lecture page renders `lectureMd` with tabs "Bài giảng / Từ vựng / Bài tập".

- [ ] **Step 1: Failing tests for `progress.ts`** — given seeded fixture rows: fresh user → exactly lesson 1 UNLOCKED, rest LOCKED; user with P1L1 COMPLETED → P1L2 UNLOCKED; `getNextLesson(last lesson of phase 1)` → first lesson of phase 2; last lesson overall → null. Run → FAIL.
- [ ] **Step 2: Implement `progress.ts` → tests PASS.**
- [ ] **Step 3: Dashboard UI** — vertical phase timeline; each phase a card with progress bar `x/y bài`; lessons as a wrapping list of pill nodes (✓ done / ▶ unlocked / 🔒 locked / ⏭ skipped-but-clickable). Locked lessons unclickable with tooltip "Hoàn thành bài trước để mở khóa".
- [ ] **Step 4: Lecture page** — `MarkdownContent` = `react-markdown` + `remark-gfm`, Tailwind typography-styled tables/blockquotes (the lectures are table-heavy — check rendering against `phase_1_foundation/lesson_01_simple_present/lecture.md`). Header: phase + lesson title, tab bar linking to `./vocab` and `./exercise`. Guard: locked lesson URL → redirect dashboard.
- [ ] **Step 5: Verify in browser** — dashboard shows 5 phases/~54 lessons, only lesson 1 clickable; lecture tables render well.
- [ ] **Step 6: Commit** — `git commit -m "feat(web): dashboard lesson map + lecture reader"`

---

### Task 8: Grading library (answer matching)

**Files:**
- Modify: `web/src/lib/grading/normalize.ts` (exists from Task 4)
- Create: `web/src/lib/grading/match.ts`
- Test: `web/src/lib/grading/match.test.ts`

**Interfaces:**
- Consumes: `normalize()` (Task 4), `AnswerVariant.normalized` shape.
- Produces:
```ts
export type MatchResult = { correct: true; matchType: "EXACT" | "VARIANT" | "FUZZY" | "MANUAL" } | { correct: false };
export function matchAnswer(input: string, question: {
  kind: QuestionKind; isOpenEnded: boolean;
  variants: { normalized: string }[];
}): MatchResult;
```

- [ ] **Step 1: Failing tests** — table-driven: exact variant hit → EXACT; contraction equivalence (`is not` ↔ `isn't`, `does not` ↔ `doesn't`, `do not`, `are not`, `cannot`…) → VARIANT; TRANSFORMATION with ≥0.85 Levenshtein similarity (`"When do they play football ?"` vs key) → FUZZY; FILL_BLANK near-miss (`cook` vs `cooks`) → **incorrect** (fuzzy only for sentence kinds); `isOpenEnded` + ≥15 chars → MANUAL; empty/whitespace → incorrect. Run → FAIL.
- [ ] **Step 2: Implement** — contraction expansion generates all equivalent forms of the input before variant comparison; plain-DP Levenshtein (no dependency), `similarity = 1 - dist/maxLen`, fuzzy gate only when `kind ∈ {TRANSFORMATION, TRANSLATION, ERROR_CORRECTION}`.
- [ ] **Step 3: Run → PASS.**
- [ ] **Step 4: Commit** — `git commit -m "feat(web): answer normalization + matching library"`

---

### Task 9: Exercise runner (core loop)

**Files:**
- Create: `web/src/app/(app)/learn/[phase]/[lesson]/exercise/page.tsx`
- Create: `web/src/components/ExerciseRunner.tsx`, `web/src/components/runner/{QuestionCard,ExplanationSlot}.tsx`
- Create: `web/src/app/api/exercises/[id]/attempts/route.ts`, `web/src/app/api/attempts/[id]/answers/route.ts`
- Create: `web/src/lib/ai/grader.ts`
- Test: `web/src/components/runner/reducer.test.ts`, `web/src/app/api/attempts/answers.test.ts` (integration, test DB)

**Interfaces:**
- Consumes: questions (Task 4 seed), `matchAnswer` (Task 8), `getNextLesson` (Task 7), session (Task 5).
- Produces:
  - `POST /api/exercises/[id]/attempts` → `{attemptId, currentQuestionNumber}` — resumes the open attempt or (`{redo: true}`) creates a fresh one.
  - `POST /api/attempts/[id]/answers` `{questionId, answerText}` → `{correct: boolean, matchType?, keyNote?, correctAnswer?, explanation: string | null, completedLesson?: {nextLessonSlug: string | null}}` (`correctAnswer` only returned when correct).
  - `lib/ai/grader.ts`:
```ts
export interface ExplainInput { questionPrompt: string; questionKind: string; userAnswer: string; correctAnswers: string[]; keyNote: string | null; lessonSlug: string }
export interface Explainer { explain(i: ExplainInput): Promise<string | null> }
export class NullExplainer implements Explainer { async explain() { return null } }
export const explainer: Explainer = new NullExplainer(); // FUTURE: env-gated HttpExplainer
```

- [ ] **Step 1: Failing reducer tests** — client state machine `answering → checking → correct | incorrect`; `incorrect` keeps input editable and increments a local `tries` display; `correct` → "Tiếp tục" advances index; last question `correct` → `finished`. Run → FAIL.
- [ ] **Step 2: Implement reducer → PASS.**
- [ ] **Step 3: Failing API integration tests** — with a seeded mini-exercise: wrong answer → `{correct: false}` and `AttemptAnswer.wrongAnswers` grows, `explanation` stays null (NullExplainer); right answer → correct + keyNote; answering the final question sets `completedAt`, upserts `LessonProgress` COMPLETED for the lesson + UNLOCKED for `getNextLesson()` **in one transaction**; `redo: true` creates a new attempt while old rows remain. Run → FAIL.
- [ ] **Step 4: Implement route handlers** — answer check order: `matchAnswer` → persist via upsert on `(attemptId, questionId)`; on wrong: call `await explainer.explain(...)` and store result (null now — the wiring is the point); advance `currentQuestionNumber` only on correct. Run → PASS.
- [ ] **Step 5: Build the UI** — RSC page loads attempt + questions **without answerRaw/variants**, passes to `ExerciseRunner` (client). Per-kind inputs: MCQ = option buttons; FILL_BLANK = inline text inputs replacing `______`; others = textarea. Progress bar `câu x/y`. Wrong → red shake + "Chưa đúng, thử lại" + `<ExplanationSlot explanation={null}/>` (renders nothing when null — the future AI slot). Correct → green flash + correct answer + keyNote + "Tiếp tục". Finish screen: 🎉 + "Mở khóa: [next lesson title]" + buttons "Bài tiếp theo" / "Làm lại" (redo). Refresh mid-attempt resumes at `currentQuestionNumber`.
- [ ] **Step 6: E2E verify** — complete lesson 1's 39 questions in the browser (or a trimmed seed), confirm lesson 2 unlocks on dashboard; redo starts clean at question 1.
- [ ] **Step 7: Commit** — `git commit -m "feat(web): exercise runner with retry-until-correct and lesson unlocking"`

---

### Task 10: Vocabulary flashcards + progress

**Files:**
- Create: `web/src/app/(app)/learn/[phase]/[lesson]/vocab/page.tsx` (hub), `.../vocab/flashcards/page.tsx`
- Create: `web/src/components/vocab/Flashcards.tsx`, `web/src/app/api/vocab/review/route.ts`, `web/src/lib/vocab.ts`
- Test: `web/src/lib/vocab.test.ts`

**Interfaces:**
- Consumes: VocabWord rows (Task 3), session (Task 5).
- Produces: `POST /api/vocab/review` `{results: {wordId: string; correct: boolean}[]}` → Leitner update (`correct: box+1 max 5; wrong: box 0`); `getVocabStats(userId, lessonId): {learned: number; total: number}` (learned = box ≥ 3). Word data (not secret) may go to the client.

- [ ] **Step 1: Failing tests for Leitner logic + stats. Run → FAIL.**
- [ ] **Step 2: Implement `vocab.ts` + review route → PASS.**
- [ ] **Step 3: Hub page** — group cards by `groupName`, stats ring "Đã thuộc x/60", links to 3 modes.
- [ ] **Step 4: Flashcards** — card flip animation (word+IPA front / meaning+example back), self-report buttons "Đã nhớ ✓ / Chưa nhớ ✗", batch-POST results at session end; end screen with tally.
- [ ] **Step 5: Verify in browser; commit** — `git commit -m "feat(web): vocab hub + flashcards with Leitner progress"`

---

### Task 11: Vocabulary games (quiz + match)

**Files:**
- Create: `.../vocab/quiz/page.tsx`, `.../vocab/match/page.tsx`
- Create: `web/src/components/vocab/{QuizGame,MatchGame}.tsx`
- Test: `web/src/components/vocab/games.test.ts` (distractor sampling, pair-shuffle logic)

**Interfaces:**
- Consumes: VocabWord rows, `POST /api/vocab/review` (Task 10).

- [ ] **Step 1: Failing tests** — distractor sampler returns 3 wrong meanings from the same lesson, no duplicates, never the correct one; match-round generator yields 6 shuffled pairs per round. Run → FAIL.
- [ ] **Step 2: Implement pure helpers → PASS.**
- [ ] **Step 3: QuizGame** — 10 rounds, random EN→VI or VI→EN, 4 options, instant right/wrong color feedback, streak counter, results → review API.
- [ ] **Step 4: MatchGame** — two shuffled columns (EN / VI), tap-to-pair, wrong pair shakes red, timer + best-time in `localStorage`, results → review API.
- [ ] **Step 5: Verify both games in browser; commit** — `git commit -m "feat(web): vocab quiz + word-match games"`

---

### Task 12: Listening pipeline (authoring → TTS → player)

**Files:**
- Create: `web/content/listening/practice_01.md`, `web/content/listening/placement_01.md`
- Create: `web/scripts/tts/generate_audio.py`, `web/scripts/tts/requirements.txt` (`edge-tts==6.*`, `pydub`)
- Create: `web/scripts/seed/parse-listening.ts` (front matter + transcript; reuses `parseExercise` for `## QUESTIONS`)
- Create: `web/src/app/(app)/listening/{page.tsx,[slug]/page.tsx}`, `web/src/components/AudioPlayer.tsx`
- Modify: `web/scripts/seed/ingest.ts` (seed listening sets)
- Test: `web/scripts/seed/parse-listening.test.ts`

**Interfaces:**
- Consumes: `parseExercise` (Task 4), Section/Question models, answer-check API (Task 9 — listening sets create an ExerciseAttempt-like flow; reuse the same `/api/attempts` routes by seeding listening questions under a Section with `listeningSetId`, and accept `sectionSource: "listening"` in the attempt-start route keyed by ListeningSet slug).
- Produces: authoring format below; `web/public/audio/listening/{slug}.mp3` committed; listening pages playable end-to-end.

Authoring format (`web/content/listening/*.md`):
```markdown
---
slug: placement_01
title: "Placement Listening: Booking a Community Class"
kind: PLACEMENT
voices: { A: en-GB-SoniaNeural, B: en-US-GuyNeural, NARRATOR: en-US-JennyNeural }
---
## TRANSCRIPT
NARRATOR: Section 1. You will hear a conversation about booking a class.
A: Good morning, Greenfield Community Centre.
B: Hi, I'd like to sign up for the photography course...
## QUESTIONS
## SECTION A: FILL IN THE BLANK (Điền vào chỗ trống)
1. The course starts on ______ .
...
## ANSWER KEY (ĐÁP ÁN)
### Section A:
1. Monday / monday
```

- [ ] **Step 1: Author `practice_01.md`** — ~2 min dialogue, 5 FILL_BLANK + 5 MCQ, IELTS Section-1 style, with answer key.
- [ ] **Step 2: Failing parse-listening test** (front matter, transcript extraction, question reuse). Run → FAIL → implement → PASS.
- [ ] **Step 3: Implement `generate_audio.py`** — parse transcript lines `SPEAKER: text`, synth each with that speaker's voice via `edge-tts`, concatenate with 400 ms silences (`pydub`), export 48 kbps mono mp3 to `web/public/audio/listening/{slug}.mp3`, print duration. Run: `python scripts/tts/generate_audio.py content/listening/practice_01.md` → mp3 exists, plays, ~1–2 MB.
- [ ] **Step 4: Seed + build pages** — `/listening` lists sets (PRACTICE only); `[slug]` page: sticky `AudioPlayer` (play/pause, seek, ±10s, speed 0.75/1/1.25 — native `<audio>` wrapped in shadcn styling) above the question runner (reuses runner components from Task 9); transcript hidden behind "Xem transcript" accordion, enabled after completion.
- [ ] **Step 5: E2E verify in browser; commit** (including the mp3) — `git commit -m "feat(web): listening authoring + edge-tts pipeline + player"`

---

### Task 13: Placement test + start-point assignment

**Files:**
- Create: `web/content/listening/placement_01.md` (authored in Task 12 Step 1 format; ~2.5 min, 5 FILL_BLANK + 5 MCQ)
- Create: `web/scripts/seed/seed-placement.ts` (reading from `ielts_practice_tests/test_01/reading.md` passages 1–2 + its band table; writing prompt from `test_01/writing.md` Task 2)
- Create: `web/src/app/onboarding/placement/{page.tsx,result/page.tsx}`, `web/src/components/PlacementWizard.tsx`
- Create: `web/src/app/api/placement/{submit-section,complete}/route.ts`
- Create: `web/src/lib/band.ts`
- Test: `web/src/lib/band.test.ts`

**Interfaces:**
- Consumes: PlacementTest/PlacementAttempt models, `matchAnswer`, AudioPlayer, `getLessonStates` conventions (SKIPPED rows).
- Produces:
```ts
export function rawToBand(raw: number, table: {min: number; band: number}[]): number
export function placementBand(reading: number, listening: number, table: ...): number  // mean, rounded to nearest 0.5
export function startLessonFor(band: number): { phaseSlug: string }
// <3.5 → phase_1; 3.5–4.5 → phase_2; 5.0–5.5 → phase_3; 6.0–6.5 → phase_4; ≥7.0 → phase_5 (first lesson)
```
On completion: `User.placementBand` set; LessonProgress rows: all lessons before the start lesson → SKIPPED, start lesson → UNLOCKED. Writing answer stored ungraded (`writingText`) — graded later by the deferred AI model.

- [ ] **Step 1: Failing `band.ts` tests** (band table edges, rounding to 0.5, phase mapping boundaries). Run → FAIL → implement → PASS.
- [ ] **Step 2: Author placement listening set + generate its mp3** (pipeline from Task 12).
- [ ] **Step 3: `seed-placement.ts`** — extract passages + questions + band table from test_01 files (same parser techniques as Task 4; test_01 `answer_key.md` reading section is machine-readable). Run seed, verify in studio.
- [ ] **Step 4: Wizard UI** — 3 steps with stepper: Nghe (player + 10 questions, one submit) → Đọc (passages + questions) → Viết (prompt + textarea, min 150 words counter, "sẽ được chấm sau" note). Sections auto-graded server-side on submit (`matchAnswer`); no per-question retry here (it's a test, not practice).
- [ ] **Step 5: Result page** — band số to lớn, per-skill breakdown, writing "Đã lưu — chờ chấm điểm AI (sắp ra mắt)", assigned start point with CTA "Bắt đầu học" + option "Tôi muốn bắt đầu từ đầu" (clears SKIPPED rows, unlocks P1L1 instead).
- [ ] **Step 6: E2E verify full onboarding flow; commit** — `git commit -m "feat(web): placement test (listening/reading/writing) + start-point assignment"`

---

### Task 14: IELTS practice test browser

**Files:**
- Create: `web/scripts/seed/seed-ielts.ts` (30 tests → IeltsTest rows; `isComplete=false` when answer_key.md missing/reading-only — per STATUS.md: incomplete = 12–14, 16, 18, 20–30 vary; detect by file presence + non-empty content, don't hardcode)
- Create: `web/src/app/(app)/ielts/{page.tsx,[n]/page.tsx}`

**Interfaces:**
- Consumes: `MarkdownContent` (Task 7).
- Produces: `/ielts` grid of 30 test cards (incomplete ones badged "Chưa đủ nội dung" and de-emphasized); `/ielts/[n]` tabs Reading/Writing/Speaking rendered from markdown, answer key behind a collapsed "Xem đáp án" accordion with a warning ("chỉ xem sau khi tự làm").

- [ ] **Step 1: Seed script + run; spot-check counts (30 rows, correct isComplete flags).**
- [ ] **Step 2: Build pages; verify test_01 renders all tabs + key reveal works.**
- [ ] **Step 3: Commit** — `git commit -m "feat(web): IELTS practice test browser"`

---

### Task 15: Polish + production launch

**Files:**
- Modify: various — loading/error states, empty states, mobile pass
- Create: `web/src/app/(app)/settings/page.tsx`, `web/README.md`

**Interfaces:**
- Consumes: everything.
- Produces: production deployment with seeded content, documented ops.

- [ ] **Step 1: Settings page** — show email/goal, change goal (re-runs nothing, just updates User), "Làm lại bài kiểm tra đầu vào" link, logout.
- [ ] **Step 2: Polish pass** — `loading.tsx` skeletons for dashboard/lesson/exercise; `error.tsx` boundaries; mobile check of runner + games; Vietnamese copy review; favicon + app title "Học tiếng Anh".
- [ ] **Step 3: Seed production** — run `npm run seed && tsx scripts/seed/seed-placement.ts && tsx scripts/seed/seed-ielts.ts` against production `DIRECT_URL`. Document in `web/README.md`: env vars, seeding procedure ("content changes → re-run seed locally"), TTS regeneration, Resend domain-verification requirement.
- [ ] **Step 4: Production smoke test** — real signup with OTP email on the Vercel URL → onboarding → placement → lesson 1 lecture → 3 exercise questions → flashcards. All green.
- [ ] **Step 5: Commit + final deploy** — `git commit -m "feat(web): settings, polish, production launch"` then `npx vercel deploy --prod`.

---

## Deferred Work (tracked, NOT in this plan)

> **Ghi chú cho tương lai (user yêu cầu note lại):** Người dùng sẽ tự host một model (fine-tune / PEFT ~1% params, ví dụ LoRA) trên hạ tầng **serverless pay-per-compute**, và web sẽ gọi API của model đó.

1. **AI wrong-answer explanations** — implement `HttpExplainer implements Explainer` in `web/src/lib/ai/grader.ts`, activated by `AI_GRADER_URL` + `AI_GRADER_API_KEY` env vars; POST `{questionPrompt, questionKind, userAnswer, correctAnswers, keyNote, lessonSlug}` → explanation text; store in `AttemptAnswer.explanation` + `explanationModel`; `<ExplanationSlot>` already renders it. Prompt/report style should follow `.claude/skills/grading-english-exercises/SKILL.md` (STANDARD-EXPLANATION: ✅ why correct / ❌ why yours is wrong / 📘 rule / ⚠️ tip).
2. **AI writing/speaking grading** — `EssayGrader` interface next to `Explainer`; grade placement `writingText` (fills `writingBand`/`writingFeedback`) and future IELTS writing submissions; IELTS band estimates labeled "tự ước lượng" per the grading skill's convention.
3. **Open-ended answer grading** — replace the MANUAL auto-accept for `isOpenEnded` questions with real AI grading.
4. **Phase exams in-app** (`phase_*/exam/`) — currently skipped by the seed; add as end-of-phase gated tests.
5. **More listening sets** — pipeline exists; author more `content/listening/*.md`.
6. **Interactive IELTS reading** (auto-graded in-app instead of self-check markdown).

## Verification (end-to-end)

1. `cd web && npm run test` — all vitest suites green (parsers, grading, OTP, progress, band, reducers).
2. `npm run seed:validate -- --strict` — exits 0 across all ~54 lessons.
3. Local e2e: fresh signup (OTP via Resend to own Gmail) → goal selection → placement (listen to mp3, answer, see band + start point) → open assigned lesson → read lecture → answer exercise questions incl. one deliberately wrong (see retry feedback, empty explanation slot) → finish → next lesson unlocks → flashcards + both games update "Đã thuộc" → `/ielts/1` renders with key reveal → logout/login again → progress intact (core requirement: no reset).
4. Production smoke test on the Vercel URL (Task 15 Step 4).
