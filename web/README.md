# Học tiếng Anh — web app

A Next.js 15 / React 19 / TypeScript app for personalised English learning:
Google OAuth (NextAuth v5) auth, onboarding (learning-goal selection + a real
listening/reading/writing placement test), a lesson dashboard with lecture
pages, a retry-until-correct exercise runner with lesson unlocking, vocab
flashcards + two mini-games (quiz, word-match) with Leitner-box spaced
repetition, a listening pipeline (`edge-tts`-generated mp3s), and an IELTS
practice-test browser.

## Current deployment status (read this first)

**This project has never been deployed.** Every prior task (1–14) and this
one were built and verified entirely against:

- A **local Postgres** instance (not Neon) — `DATABASE_URL`/`DIRECT_URL` both
  point at `localhost:5432` in `.env.local`.
- Login is via Google OAuth (NextAuth v5); `AUTH_GOOGLE_ID` **and**
  `AUTH_GOOGLE_SECRET` (from a Google Cloud OAuth 2.0 Client ID) must be set
  in `web/.env.local` / root `.env`, otherwise sign-in fails.
- **No Vercel project exists.** `next build && next start` (a local
  production build) is the closest thing to a "production smoke test" this
  app has had.

This was an explicit, human-operator decision made back in Task 1 to defer
Neon/Vercel setup until the app itself was fully built and verified.
**Before an actual production launch**, a human operator needs to:

1. Create a Neon Postgres project, set `DATABASE_URL` (pooled) and
   `DIRECT_URL` (direct) to it, run `prisma migrate deploy` against it, then
   run the seed procedure below against that same `DIRECT_URL`.
2. Create a Google OAuth Client (Google Cloud Console → APIs & Services →
   Credentials → OAuth 2.0 Client ID, Web application) with the production
   `AUTH_URL` as an authorized redirect URI base
   (`<AUTH_URL>/api/auth/callback/google`), and set `AUTH_GOOGLE_ID` /
   `AUTH_GOOGLE_SECRET`.
3. Create a Vercel project pointed at this repo/`web/` directory, set the
   env vars above (plus `AUTH_SECRET` and `AUTH_URL`) in its dashboard, and
   deploy (`npx vercel deploy --prod`, or via a connected Git integration).

None of that is done by this codebase — there is no Neon project, no Google
OAuth Client, no Vercel project to point at. Everything below describes the
setup that **does** exist today (local dev) and the procedure to follow
**once** the above is in place.

## Environment variables

See `.env.example`. All are required for the app to run in any mode —
**including local dev**: `npm run dev` login requires a real Google OAuth
Client (see "Current deployment status" above).

| Variable | Local dev value (today) | Production (once Neon/Google OAuth Client exist) |
|---|---|---|
| `DATABASE_URL` | `postgresql://…@localhost:5432/learning_english` | Neon **pooled** connection string — append `?pgbouncer=true` (Prisma requires this against Neon's connection pooler) |
| `DIRECT_URL` | same local Postgres URL | Neon **direct** (unpooled) connection string — used by `prisma migrate`/seed scripts |
| `AUTH_SECRET` | `openssl rand -hex 32` output, kept in `.env.local` (never committed) | A separate, real secret — do not reuse the dev one |
| `AUTH_GOOGLE_ID` | Google OAuth 2.0 Client ID | Same, from the production OAuth Client |
| `AUTH_GOOGLE_SECRET` | Google OAuth 2.0 Client secret | Same, from the production OAuth Client |
| `AUTH_URL` | `http://localhost:3000` | Public origin of the deployed app |

`web/src/middleware.ts` (edge runtime) uses NextAuth's edge-safe
`auth.config.ts` (no Prisma import), so it works unmodified against any of
the above.

## Running locally

```bash
cd web
npm install
cp .env.example .env.local   # then fill in the local Postgres URL + a generated AUTH_SECRET + Google OAuth Client credentials
npx prisma migrate dev       # creates schema against DATABASE_URL
npm run seed                 # ingest lessons + vocab + exercises from repo-root phase_*/**
npm run seed:placement       # seed the placement test (from ielts_practice_tests/test_01/)
npm run seed:ielts           # seed the 30 IELTS practice tests (ielts_practice_tests/)
npm run dev                  # http://localhost:3000
```

For a closer-to-production check (no `next dev`-only artifacts — see the
Turbopack caching note in Task 9's report), use:

```bash
npm run build && npm run start   # or: npx next start -p <port>
```

## Seeding content (local today; same procedure against Neon later)

Content lives outside the database as source-of-truth Markdown/JSON:

- `phase_*/lesson_*/` (repo root) — 52 lessons across 5 phases (`lecture.md` +
  `vocabulary.md` + `exercise.md` per lesson). The repo root is a content
  repo; `web/` never edits these files, only reads them at seed time.
- `ielts_practice_tests/test_01/` (repo root) — the placement test's source:
  Passages 1-2 + Task 2 writing prompt + the reading band-conversion table.
- `ielts_practice_tests/test_*/` (repo root) — all 30 IELTS practice tests.
- `web/content/listening/*.md` — listening-set transcripts (16 today: 2
  `PLACEMENT` sets — `placement_ielts`, `placement_toeic` — and 14 `PRACTICE`
  sets spanning CEFR A2–C1, browsable from the level-grouped Luyện Nghe hub;
  see "Listening audio" below for the authoring contract).

**The database is a disposable cache of this content.** The seed scripts are
idempotent (each `Lesson` row's `contentHash` is a hash of its 3 source
files — re-running the seed only touches lessons whose files actually
changed), so the standard workflow after any content edit is:

```bash
npm run seed              # re-ingest repo-root phase_*/**
npm run seed:placement    # re-ingest ielts_practice_tests/test_01/
npm run seed:ielts        # re-ingest ielts_practice_tests/**
npm run seed:validate -- --strict   # sanity-check the corpus (0 errors across all lessons)
```

Today this is run against local `DATABASE_URL`/`DIRECT_URL` (`dotenv -e
.env.local` wraps every `seed*`/`db:*` script already, per `package.json`).
**Once a real Neon project exists**, the exact same three commands are run
locally with `.env.local` pointed at Neon's `DIRECT_URL` (never the pooled
`DATABASE_URL` — Prisma migrations and long-running seed scripts should use
the direct connection) — content changes are deployed by re-seeding, not by
including seed logic in the app's request path or build step.

### Current local content counts (verified via `psql`, 2026-07-04)

| Table | Count |
|---|---|
| `Phase` | 5 |
| `Lesson` | 52 |
| `VocabWord` | 3419 |
| `Question` | 2168 |
| `ListeningSet` | 16 |
| `PlacementTest` | 1 |
| `IeltsTest` | 30 |

**Production seeding is deferred** until the Neon project in the table above
actually exists — there is nothing to seed today beyond this local instance,
which already has full content per the counts above.

### Known content-quality gaps (tracked, not fixed by seeding)

- 572/3419 `VocabWord` rows have an empty `meaningVi` (Task 11's finding),
  concentrated in 8 lessons that are 100% empty. The flashcards/games UI
  already renders `"(chưa có nghĩa)"` gracefully for these — this is a
  content-authoring gap, not a code bug.
- `ielts_practice_tests/test_01/answer_key.md`'s reading answer key doesn't
  match its own reading passage (Task 13's finding) — worked around
  specifically for the placement test's scoring, but the IELTS test browser
  (`/ielts/1`) intentionally renders `test_01`'s key exactly as authored,
  mismatch included — that page is a faithful self-check viewer, not a
  grader, so this is expected/correct behavior for it.

## Listening audio (TTS regeneration)

Listening-set mp3s are generated **locally, once, offline** — regeneration
is never part of the build or deploy path; the mp3s themselves are committed
to `web/public/audio/listening/` (48 kbps mono — kept for clarity on spelled
names/numbers; ~0.36 MB/min, so the whole `PRACTICE` corpus adds roughly
120–140 MB to the repo, accepted as a one-time cost).

```bash
cd web/scripts/tts
python3 -m venv .venv        # one-time
source .venv/bin/activate
pip install -r requirements.txt
cd ../..                     # back to web/
python scripts/tts/generate_audio.py content/listening/practice_a2_01.md
```

`requirements.txt` pins **`edge-tts==7.2.8`**, not the `6.*` originally
specified in the build plan — `edge-tts` 6.1.19 (the latest 6.x release)
fails against Microsoft's current speech endpoint with an HTTP 403 (a
`Sec-MS-GEC`/DRM-token-derivation drift between `edge-tts` 6.x and Edge's
actual client version; see `edge-tts`'s changelog around its 7.0 rewrite).
7.2.8 is the first 7.x release confirmed working end-to-end in this
environment. **Re-verify with `edge-tts --version` and a real
`generate_audio.py` run before ever bumping this pin.** Avoid running more
than 2–3 `generate_audio.py` invocations concurrently (edge-tts throttling);
each line gets a 3× retry already, and regeneration is idempotent per file.

### Authoring a new PRACTICE listening set

`PRACTICE` sets (as opposed to the two hardcoded `PLACEMENT` sets used only
by the onboarding wizard) are what the level-grouped Luyện Nghe hub
(`/listening`) lists, and every one of them must satisfy a rigid structural
contract so the sectioned runner and per-section transcript unlock work:

1. **Front matter**: `slug` (must equal the filename), `title` (globally
   unique — checked against every other listening set, including the two
   placement sets), `kind: PRACTICE`, `level: A2|B1|B2|C1` (required for
   `PRACTICE`; grouped under a "Khác" bucket in the hub if missing — the seed
   script warns on this), and `voices: { A: <edge-tts voice>, ... }` mapping
   every transcript speaker code, including `NARRATOR`, to a voice name.
   `NARRATOR` is always `en-US-JennyNeural`; never reuse Jenny for a
   character voice.
2. **Shape**: exactly 4 `## SECTION N: <TITLE>` blocks × 10 questions each,
   numbered 1–40 globally ascending, with a matching `### Section N:` block
   in `## ANSWER KEY (ĐÁP ÁN)`. Section titles must be **exactly**
   `FILL IN THE BLANK (Điền vào chỗ trống)` or
   `MULTIPLE CHOICE (Trắc nghiệm)` — these exact strings drive `inferKind`
   in `scripts/seed/parse-exercise.ts`; anything else (e.g. a "MIXED" title)
   degrades to an unusable kind.
3. **Transcript markers**: every section's transcript must open with a line
   starting `NARRATOR: Section N. …` (this is what
   `src/lib/transcript.ts#transcriptChunksForSections` splits on to unlock
   each section's transcript as the learner completes it) and close with a
   narrator outro line that does **not** start with `NARRATOR: Section` (a
   line like `NARRATOR: That is the end of Section N…` is fine). A mid-section
   pause/break line (used at B2/C1 to split a long section) must also avoid
   starting with `NARRATOR: Section` — phrase it as e.g.
   `NARRATOR: We now continue with the second half…` instead, or it gets
   miscounted as an extra section marker.
4. **Pauses**: `[PAUSE:n]` alone on its own line, in seconds, per the level's
   budget (intro pause to read the questions + outro pause to check answers,
   per section): A2 = 20+15s, B1 = 25+20s, B2 = 30+25s (plus one `[PAUSE:15]`
   mid-Section-3), C1 = 40+30s (plus `[PAUSE:15]` mid-Section-3 **and**
   mid-Section-4). The validator warns outside a [90, 600]s total budget or
   on any single pause over 60s.
5. **Answers**: FILL questions need exactly one `______` and answers ≤ 3
   words, alternates `/`-separated (e.g. `45 / forty-five`), and must appear
   in the transcript in question order; MCQ needs 3–4 `- A) text` options and
   a key line like `21. B (short justification)` (the parenthetical becomes
   the runner's `keyNote`). No `![](...)` images in `PRACTICE` sets — audio
   only.
6. **Duration bands** (validator WARN-only, since the word-count estimator is
   heuristic): A2 15–18 min, B1 19–22 min, B2 23–27 min, C1 28–32 min real
   `ffprobe` duration (slightly wider validator tolerance bands — see
   `LEVEL_DURATION_TARGETS` in `scripts/seed/check-listening.ts`). Empirically,
   generated audio runs **~7–10% shorter** than the validator's `est≈` figure
   (measured across all 14 `PRACTICE` sets in this corpus), so target word
   counts a bit above the naive per-level midpoint and re-check with a real
   `ffprobe` run after generating.
7. **No duplicate topics**: every `PRACTICE` set's topic/title must differ
   from every other set, including the two placement sets (leisure-centre
   signup, science-centre tour, green-space research, coral-reef lecture for
   `placement_ielts`; office/announcement snippets for `placement_toeic`).
   The validator's corpus check (`checkCorpus` in `check-listening.ts`) warns
   above a 0.30 Jaccard-shingle similarity between any two `PRACTICE`
   transcripts.

**Workflow** for a new set:

```bash
# 1. Author content/listening/<slug>.md per the contract above
npm run seed:validate-listening        # cheap structural check, no DB/audio needed
source scripts/tts/.venv/bin/activate
python scripts/tts/generate_audio.py content/listening/<slug>.md --dry-run  # sanity-check voice mapping
python scripts/tts/generate_audio.py content/listening/<slug>.md           # generate the real mp3
ffprobe -v error -show_entries format=duration -of csv=p=0 \
  public/audio/listening/<slug>.mp3    # confirm it lands in the level's duration band
npm run seed:validate-listening        # re-check now the mp3 exists (duration-band WARN)
npm run seed                           # upsert the ListeningSet + questions
npm run seed:placement                 # re-link PlacementTest FKs (npm run seed clears them — see below)
```

`npm run seed:validate-listening` never touches the database (`npm run
seed:validate-listening -- --strict` also fails on WARNs, for a stricter
pre-merge gate) — run it long before generating audio to catch structural
mistakes cheaply. Re-running `npm run seed` also **prunes** any
`ListeningSet` row whose `.md` file no longer exists in `content/listening/`
(so renaming a slug retires the old one) and **clears** `PlacementTest`'s
`listeningSetId`/`toeicListeningSetId` foreign keys every time listening
sets are reseeded — always follow with `npm run seed:placement` to relink
them, or the placement wizard's listening step shows "Phần nghe hiện chưa
sẵn sàng".

## Testing / verification

```bash
npm run test              # vitest — parsers, grading, auth, progress, band, reducers, games
npx tsc --noEmit           # typecheck
npm run lint               # eslint
npm run seed:validate -- --strict   # content corpus validation
```

## Deferred work (not implemented, tracked for a future task)

> Ghi chú cho tương lai (user yêu cầu note lại): Người dùng sẽ tự host một
> model (fine-tune / PEFT ~1% params, ví dụ LoRA) trên hạ tầng serverless
> pay-per-compute, và web sẽ gọi API của model đó.

1. **AI wrong-answer explanations** — `HttpExplainer implements Explainer`
   in `web/src/lib/ai/grader.ts`, gated by `AI_GRADER_URL` +
   `AI_GRADER_API_KEY`. `<ExplanationSlot>` already renders whatever lands in
   `AttemptAnswer.explanation`; today that column is always `null`
   (`NullExplainer`).
2. **AI writing/speaking grading** — an `EssayGrader` interface to fill
   `PlacementAttempt.writingBand`/`writingFeedback` and grade future IELTS
   writing submissions (band estimates labeled "tự ước lượng").
3. **Open-ended answer grading** — `isOpenEnded` questions currently
   auto-accept (MANUAL match type); replace with real AI grading.
4. **Phase exams** (`phase_*/exam/`) — currently skipped by the seed.
5. **Persisted listening progress** — the sectioned runner's progress is
   client-only state; refreshing mid-set loses it. A `ListeningAttempt`
   model + API would fix this but is deliberately out of scope for the
   14-set leveled expansion (see the level-grouped hub and its 14
   `PRACTICE` sets, A2×5/B1×3/B2×3/C1×3, ~15–32 min each).
6. **Interactive IELTS reading** — auto-graded in-app instead of the current
   self-check markdown key.

## Project layout

```
web/
  content/                     # lessons, placement, listening (source of truth)
  prisma/schema.prisma
  scripts/
    seed/                      # ingest.ts, seed-placement.ts, seed-ielts.ts, validate.ts
    tts/                       # generate_audio.py + its own venv
  src/
    app/
      (auth)/login, login/verify
      onboarding/path, onboarding/placement, onboarding/placement/result
      (app)/                   # shared AppHeader layout for every authenticated route
        dashboard/
        learn/[phase]/[lesson]/{, vocab, vocab/flashcards, vocab/quiz, vocab/match, exercise}
        listening/, listening/[slug]/
        ielts/, ielts/[n]/
        settings/
      api/                     # auth, onboarding, placement, exercises, attempts, vocab, listening
    components/                # ExerciseRunner, PlacementWizard, vocab games, AppHeader, etc.
    lib/                       # db, auth, grading, progress, band, vocab, exercises
```
