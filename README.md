# Learning English

A bilingual (Vietnamese/English) IELTS self-study platform. The curriculum is
written as Markdown files, seeded into Postgres, and served by a Next.js app
that never writes back to it.

**Live: [ielts.tdbao-brian.work](https://ielts.tdbao-brian.work)** — lessons are
readable without an account.

| | |
|---|---|
| Lessons | **52**, each with a lecture, vocabulary and an exercise |
| IELTS practice tests | **30**, with Reading, Writing, Speaking and answer keys |
| Levels | CEFR A1 to C1, across 5 phases |

---

## The problem this solves

Course content kept in a database is painful to work with. You cannot diff it,
cannot review a change before it ships, and cannot see the shape of the whole
course at once. Content typed into an admin panel drifts away from the plan for
the course, quietly, until nobody can say what the course actually contains.

## The architecture that answers it

**Markdown is the single source of truth.** Every lesson and every test is a
file in this repository. A seed pipeline parses those files, builds
`index/manifest.json`, and loads them into Postgres. The running application
treats that data as read-only.

```
phase_*/lesson_*/            seed pipeline           Next.js app
  lecture.md        ──────►  parse + manifest  ────►  reads only
  vocabulary.md              load into Postgres
  exercise.md
```

Two things follow from this, and both are the point:

- **Regenerating the course is a rerun, not a migration.** Fix a typo in a
  lesson, rerun the seed, and the change is live. No schema change, no data
  patch, no admin screen.
- **The course is reviewable.** A change to the curriculum arrives as a diff in
  a pull request, like any other change.

---

## What it does

- **Placement test** routes a new learner into the phase that fits, instead of
  starting everyone at A1
- **Sequential unlocking** so lessons open in order rather than all at once
- **Retry-until-correct grading** on exercises, with the answer key held back
  until the attempt is made
- **Vocabulary practice**: flashcards, a quiz and a matching game
- **Listening** from generated audio
- **30 IELTS practice tests**, browsable in full

Reading lessons needs no account. Signing in with Google saves progress.

---

## Running it

```bash
cp .env.example .env     # or: make env, which generates a session secret
make up
```

Full instructions, environment variables and the seeding procedure are in
[`web/README.md`](web/README.md).

The Markdown curriculum also renders to PDF on its own, independent of the web
app:

```bash
quarto render <file.md> --to pdf
```

---

## Stack

Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL 16 · NextAuth v5
with Google · Docker Compose · Cloudflare Tunnel

It is self-hosted on a home machine. The host opens no inbound port; traffic
arrives through an outbound tunnel.

---

## Repository map

| Path | |
|---|---|
| `phase_1_foundation/` … `phase_5_ielts_prep/` | The curriculum, 5 phases |
| `ielts_practice_tests/test_01/` … `test_30/` | Practice tests and answer keys |
| `index/manifest.json` | Machine-readable inventory, built by `scripts/build_index.py` |
| `docs/STATUS.md` | Authoring progress, in Vietnamese |
| [`web/`](web) | The Next.js application |
| [`docs/architecture.md`](docs/architecture.md) | How the pieces fit together |
| [`docs/content-model.md`](docs/content-model.md) | The shape a lesson file must have |
