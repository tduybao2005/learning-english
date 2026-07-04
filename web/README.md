# Học tiếng Anh — web app

A Next.js 15 / React 19 / TypeScript app for personalised English learning:
passwordless email OTP auth, onboarding (learning-goal selection + a real
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
- `OTP_DEV_ECHO=true` — OTP codes are printed to the server's stdout instead
  of actually being emailed, because **no real Resend account/domain was ever
  set up**. `RESEND_API_KEY` in `.env.local` is a placeholder key that has
  never sent a real email.
- **No Vercel project exists.** `next build && next start` (a local
  production build) is the closest thing to a "production smoke test" this
  app has had.

This was an explicit, human-operator decision made back in Task 1 to defer
Neon/Vercel/Resend setup until the app itself was fully built and verified.
**Before an actual production launch**, a human operator needs to:

1. Create a Neon Postgres project, set `DATABASE_URL` (pooled) and
   `DIRECT_URL` (direct) to it, run `prisma migrate deploy` against it, then
   run the seed procedure below against that same `DIRECT_URL`.
2. Verify a sending domain in Resend, set a real `RESEND_API_KEY`, and set
   `OTP_DEV_ECHO=false` (or just remove it) so OTP codes are actually emailed
   instead of logged.
3. Create a Vercel project pointed at this repo/`web/` directory, set the
   three env vars above (plus `SESSION_SECRET`) in its dashboard, and deploy
   (`npx vercel deploy --prod`, or via a connected Git integration).

None of that is done by this codebase — there is no Neon project, no Resend
domain, no Vercel project to point at. Everything below describes the setup
that **does** exist today (local dev) and the procedure to follow **once**
the above is in place.

## Environment variables

See `.env.example`. All five are required for the app to run in any mode:

| Variable | Local dev value (today) | Production (once Neon/Resend exist) |
|---|---|---|
| `DATABASE_URL` | `postgresql://…@localhost:5432/learning_english` | Neon **pooled** connection string |
| `DIRECT_URL` | same local Postgres URL | Neon **direct** (unpooled) connection string — used by `prisma migrate`/seed scripts |
| `SESSION_SECRET` | `openssl rand -hex 32` output, kept in `.env.local` (never committed) | A separate, real secret — do not reuse the dev one |
| `RESEND_API_KEY` | placeholder (`re_...`), never used because `OTP_DEV_ECHO=true` | Real Resend API key, after domain verification |
| `OTP_DEV_ECHO` | `true` — OTP codes are printed to server stdout as `[OTP_DEV_ECHO] OTP code for <email>: <code>`, and `sendOtpEmail` still attempts to send via Resend (silently fails today since the key is a placeholder) | `false` (or unset) — real emails only, no console echo |

`web/src/middleware.ts` (edge runtime) only reads `SESSION_SECRET` and only
imports `jose` — it validates the JWT signature statelessly, with no Prisma
import, so it works unmodified against any of the above.

## Running locally

```bash
cd web
npm install
cp .env.example .env.local   # then fill in the local Postgres URL + a generated SESSION_SECRET
npx prisma migrate dev       # creates schema against DATABASE_URL
npm run seed                 # ingest lessons + vocab + exercises from content/lessons/**
npm run seed:placement       # seed the placement test (content/placement/)
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

- `web/content/lessons/**` — 52 lessons across 5 phases (lecture + vocab +
  exercise `.md` per lesson).
- `web/content/placement/` — the single placement test (listening/reading/
  writing sections + band table).
- `ielts_practice_tests/test_*/` (repo root) — 30 IELTS practice tests.
- `web/content/listening/*.md` — listening-set transcripts (2 today:
  `practice_01`, `placement_01`).

**The database is a disposable cache of this content.** The seed scripts are
idempotent (each `Lesson` row's `contentHash` is a hash of its 3 source
files — re-running the seed only touches lessons whose files actually
changed), so the standard workflow after any content edit is:

```bash
npm run seed              # re-ingest web/content/lessons/**
npm run seed:placement    # re-ingest web/content/placement/
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
| `ListeningSet` | 2 |
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
to `web/public/audio/listening/`.

```bash
cd web/scripts/tts
python3 -m venv .venv        # one-time
source .venv/bin/activate
pip install -r requirements.txt
cd ../..                     # back to web/
python scripts/tts/generate_audio.py content/listening/practice_01.md
```

`requirements.txt` pins **`edge-tts==7.2.8`**, not the `6.*` originally
specified in the build plan — `edge-tts` 6.1.19 (the latest 6.x release)
fails against Microsoft's current speech endpoint with an HTTP 403 (a
`Sec-MS-GEC`/DRM-token-derivation drift between `edge-tts` 6.x and Edge's
actual client version; see `edge-tts`'s changelog around its 7.0 rewrite).
7.2.8 is the first 7.x release confirmed working end-to-end in this
environment. **Re-verify with `edge-tts --version` and a real
`generate_audio.py` run before ever bumping this pin.**

To add a new listening set: author a new `content/listening/<slug>.md` file
(front matter `slug`/`title`/`kind`/`voices`, then a `## TRANSCRIPT` section
of `SPEAKER: text` lines, optionally a `## QUESTIONS` section), run
`generate_audio.py` against it, then `npm run seed` (the seed pipeline picks
up new listening-set content the same way it picks up lesson content).

## Testing / verification

```bash
npm run test              # vitest — parsers, grading, OTP, progress, band, reducers, games
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
5. **More listening sets** — pipeline exists (see above), only 2 sets
   authored so far.
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
