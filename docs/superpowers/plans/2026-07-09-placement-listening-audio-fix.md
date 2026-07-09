# Placement Listening Audio Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> On execution, also save a copy of this plan to `docs/superpowers/plans/2026-07-09-placement-listening-audio-fix.md` (repo convention).

**Goal:** Make the listening audio actually appear in the entrance/placement test ("kiểm tra đầu vào") shown after first login in the deployed app.

## Context (why)

The user asked to "thêm audio cho bài kiểm tra listening ở phần kiểm tra đầu vào sau khi log in lần đầu". Investigation shows the feature is **already fully built** in code:

- `web/src/components/PlacementWizard.tsx` — listening step renders `<AudioPlayer src={listening.audioUrl} />` (line 230).
- `web/src/components/AudioPlayer.tsx` — complete player (play/pause, ±10s, seek, 0.75/1/1.25x).
- `web/content/listening/placement_01.md` — authored transcript + questions; `web/public/audio/listening/placement_01.mp3` — committed TTS audio (present in the running container at `/app/web/public/audio/listening/`).
- `web/scripts/seed/ingest.ts` seeds `ListeningSet` from `web/content/listening/*.md`; `web/scripts/seed/seed-placement.ts` links it via `PlacementTest.listeningSetId`.

**But in the running deployment it's broken.** Verified live:

```
PlacementTest.listeningSetId = NULL   (docker exec learning_english-db-1 psql …)
ListeningSet: 0 rows
docker exec learning_english-web-1 ls /app/web/content  →  No such file or directory
```

**Root cause:** `web/Dockerfile`'s runner stage copies `.next`, `public`, `scripts`, `src`, `prisma` — **but not `web/content/`**. When `make seed` runs `ingest.ts` inside the container, `seedListeningSets()` hits its silent-skip branch (`ingest.ts:71-75`: "no web/content/listening directory — skipping listening sets"), so `ListeningSet` stays empty, `seed-placement.ts` finds no set for slug `placement_01` (warns at line 575) and leaves `listeningSetId` NULL, and the wizard falls back to "Phần nghe hiện chưa sẵn sàng".

So this is a 1-line Dockerfile fix + rebuild + reseed — no new UI, schema, or audio work. (`.dockerignore` does not exclude `web/content`, and the builder stage already has it via `COPY web/ ./`.)

**Tech stack:** Docker/docker-compose, Next.js 15, Prisma/Postgres, tsx seed scripts, Makefile.

## Global Constraints

- Listening audio regeneration never runs on the deploy path — mp3s are committed (per `docs/superpowers/plans/2026-07-02-english-learning-web-app.md`). No TTS involved here.
- Vietnamese UI copy; don't change existing content or answer keys.
- Work directly on `main`.

---

### Task 1: Copy `web/content/` into the runner image

**Files:**
- Modify: `web/Dockerfile` (runner stage, after line 52 `COPY --from=builder /app/web/tsconfig.json ./tsconfig.json`)

**Interfaces:**
- Produces: `/app/web/content/listening/*.md` inside the container, which `scripts/seed/ingest.ts:71` (`path.join(repoRoot, "web", "content", "listening")`) resolves at seed time.

- [ ] **Step 1: Add the COPY line**

```dockerfile
# Listening-set sources (web/content/listening/*.md) — ingest.ts seeds
# ListeningSet from these at runtime; without them the seed silently skips
# listening and the placement wizard shows "Phần nghe hiện chưa sẵn sàng".
COPY --from=builder /app/web/content ./content
```

Place it right after the `tsconfig.json` COPY (line 52), before the curriculum-content COPY block.

- [ ] **Step 2: Rebuild and restart the web container**

Run from repo root:
```bash
docker compose build web && docker compose up -d web
```
Expected: build succeeds; `docker exec learning_english-web-1 ls /app/web/content/listening` shows `placement_01.md practice_01.md`.

- [ ] **Step 3: Commit**

```bash
git add web/Dockerfile
git commit -m "fix(docker): copy web/content into runner image so seed can ingest listening sets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Reseed listening sets and relink the placement test

No code changes — runtime data fix, must run after Task 1's rebuilt container is up.

**Interfaces:**
- Consumes: `/app/web/content/listening/*.md` in the container (Task 1).
- Produces: `ListeningSet` rows (slugs `placement_01`, `practice_01`) and `PlacementTest.listeningSetId` pointing at `placement_01`.

- [ ] **Step 1: Run the seeds (order matters — ingest first, then placement)**

```bash
make seed            # runs: docker compose exec web npx tsx scripts/seed/ingest.ts
docker compose exec web npx tsx scripts/seed/seed-placement.ts
```
Expected: ingest logs seeding of 2 listening sets (no "skipping listening sets" line); seed-placement logs `listeningSetId=<id>` (not `null`) and no WARN about missing slug `placement_01`.

Caution: `seed-placement.ts` deletes prior `PlacementAttempt` rows for the test (see its comments around line 581) — acceptable here; flag to the user if real learner attempts must be preserved.

- [ ] **Step 2: Verify in the database**

```bash
docker exec learning_english-db-1 psql -U learning_english -d learning_english \
  -c "SELECT slug, \"listeningSetId\" FROM \"PlacementTest\";" \
  -c "SELECT slug, \"audioUrl\" FROM \"ListeningSet\";"
```
Expected: `default | <non-null id>`; two ListeningSet rows with `/audio/listening/placement_01.mp3` and `/audio/listening/practice_01.mp3`.

---

### Task 3: End-to-end verification in the app

- [ ] **Step 1: Drive the placement page**

Using Playwright MCP (or a browser) against `http://localhost:3000`:
1. Log in (or use an account that hasn't completed placement) and go to `/onboarding/placement`.
2. Confirm step "Nghe" shows the AudioPlayer (play button, seek bar, speed chips) instead of "Phần nghe hiện chưa sẵn sàng".
3. Confirm `GET /audio/listening/placement_01.mp3` returns 200 (network tab or `curl -sI http://localhost:3000/audio/listening/placement_01.mp3`).
4. Press play; time counter advances.

- [ ] **Step 2: Regression check**

```bash
cd web && npx vitest run
```
Expected: all tests pass (no code besides the Dockerfile changed).

---

## Out of scope (noted for the user)

- TOEIC `listening.md` placeholders (repo-root corpus) remain empty — separate feature.
- Hardening idea (optional follow-up): make `ingest.ts`'s silent skip at line 72-75 a loud error in production so this class of drift can't recur.
