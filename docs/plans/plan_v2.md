# Curriculum Upgrade (plan_v2 + Expanded Practice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an improved, reality-aligned curriculum framework and substantially expand practice volume — richer `lecture.md` files, higher-quota `exercise.md` files, new per-phase cumulative review sets, and more complete IELTS practice tests.

**Architecture:** Pure Markdown content project rendered to PDF by Quarto (`_quarto.yml` renders all `**/*.md`). No application code. Work is organized by content workstream; each lesson folder holds `lecture.md` + `vocabulary.md` + `exercise.md`; each phase has an `exam/` folder; `ielts_practice_tests/test_NN/` holds `reading.md`, `writing.md`, `speaking.md`, `answer_key.md`.

**Tech Stack:** Markdown, Quarto (`quarto render`), Bash for verification (wc/grep). Content is bilingual: Vietnamese explanations, English examples (full diacritics required).

## Context

`STATUS.md` is badly out of date. The **actual** state on disk:

- **Phases 1–5 are all complete** — every lesson has `lecture.md` + `vocabulary.md` + `exercise.md`, and every phase has both exam files. (STATUS.md still lists Phase 4/5 as unfinished — wrong.)
- **IELTS tests present:** `test_01–11, 15, 17, 18, 19, 21, 22`. Incomplete: `test_18` has only `reading.md`; `test_21` and `test_22` lack `answer_key.md`. **Missing entirely:** `test_12, 13, 14, 16, 20`, and `23–50`. Target remains 50 tests.
- **Quality gaps exist** even in "complete" files — e.g. `phase_4_advanced/lesson_06_vocabulary_nuances/lecture.md` is only **149 lines** vs the ~300-line standard.

The user wants: (1) a fresh framework reflecting reality and improvements; (2) review/improve **every** `lecture.md`; (3) raise the exercise quota in **every** `exercise.md`; (4) add **cumulative review** sets per phase; (5) more IELTS tests. Goal: enough daily material to sustain ~3 hours/day study and reach IELTS 6.5–8.0 within a year.

## Global Constraints

- **Language rule:** Vietnamese for all explanations/instructions; English for all example sentences, vocabulary, model answers. Preserve full diacritics in both languages (never strip Vietnamese accents).
- **No new tooling / no code execution** beyond Markdown authoring and read-only verification (`wc`, `grep`, optional `quarto render`).
- **Follow existing file conventions exactly** — heading style (`# BÀI N: TITLE`, `## PHẦN ...`), bold question labels (`**A1.**`), table format `| # | Word / Phrase | /IPA/ | Nghĩa tiếng Việt | Ví dụ câu |`.
- **Every exercise/review/test must contain a complete answer key** in the same file (or paired `answer_key.md` for IELTS tests).
- **Listening note (verbatim, used in every IELTS `answer_key.md`):** "PHẦN NGHE (LISTENING): Phần này yêu cầu file âm thanh. Để luyện nghe IELTS, sử dụng: Cambridge IELTS Official Practice Tests (sách 14–18), website British Council tại ielts.org, hoặc YouTube 'IELTS listening practice test'."
- **Commit cadence:** one commit per lesson batch / per test, message in English, Co-Authored-By trailer per repo rules.
- **Working branch:** `ncd` (already current). Do not push unless asked.

---

## Content Standards (referenced by every task below)

### STANDARD-LECTURE (target for every `lecture.md`)
Minimum ~280 lines. Fixed section skeleton (Vietnamese headings):
1. `# BÀI N: <TITLE>` + one-line summary
2. `## MỤC TIÊU BÀI HỌC` — 3–5 bullet objectives
3. `## PHẦN 1..K` — theory parts with formulas/tables and **English** example sentences
4. `## LỖI THƯỜNG GẶP` — table: `| Sai | Đúng | Giải thích |` (≥6 rows) **(NEW — add if missing)**
5. `## TÓM TẮT NHANH` — quick-reference box / bullet cheatsheet **(NEW — add if missing)**
6. `## LIÊN KẾT BÀI HỌC` — cross-links to related lessons, e.g. `[Đảo ngữ](../lesson_01_inversion/lecture.md)` **(NEW)**

### STANDARD-EXERCISE (raised quota for every `exercise.md`)
From the current 6 sections (A–F, 35–50 questions) up to **8 sections, 55–70 questions**, then a full `# ĐÁP ÁN (ANSWER KEY)` covering every section. Keep existing A–F, then add:
- `## PHẦN G: LISTENING-STYLE DICTATION / GAP-FILL` — a short provided English transcript paragraph (in-text, no audio) with 8–10 numbered blanks to fill from context.
- `## PHẦN H: SPEAKING / DISCUSSION PROMPT` — 4–6 discussion questions using the lesson's grammar/vocab + one Band 7–8 model answer.

### STANDARD-REVIEW (new `review_exercise.md` per phase, in each phase root)
Cumulative mixed-topic drills covering **all lessons in that phase**: 60–80 questions across ≥5 formats (MCQ, transformation, error-correction, gap-fill, translation VN→EN, short writing), then full answer key. File path: `<phase_dir>/review_exercise.md`.

### STANDARD-IELTS-TEST (per `test_NN/`)
- `reading.md`: 3 passages (~500/650/750 words), 40 questions (P1 Q1–13, P2 Q14–26, P3 Q27–40).
- `writing.md`: Task 1 (~175-word model) + Task 2 (~280-word model).
- `speaking.md`: Part 1 (12 Q + answers) + Part 2 (cue card + model) + Part 3 (10 Q + answers).
- `answer_key.md`: 40 reading answers + band-conversion table + writing/speaking checklists + the verbatim listening note.

---

## Task 1: Write the improved framework document

**Files:**
- Create/update: the framework document (this file / `plan.md` successor)
- Reference (read-only): `plan.md`, `plan_change.md`, `STATUS.md`

**Interfaces:**
- Produces: the authoritative framework that Tasks 2–6 conform to (section names, standards, milestone targets).

- [ ] **Step 1: Draft the framework** with these sections:
  1. Header: goal (IELTS 6.5–8.0 in ≤12 months, ~3h/day), level→band roadmap table (reuse table from `plan.md` lines 12–19).
  2. `## TRẠNG THÁI HIỆN TẠI` — accurate snapshot: Phases 1–5 complete; IELTS tests done/incomplete/missing (mirror the Context section above).
  3. Per-phase sections (1–5): for each, the lesson list **with the file trio**, **plus** the new `review_exercise.md`, **plus** the `exam/` files. Reuse lesson tables from `plan.md` but append the review-set row.
  4. `## TIÊU CHUẨN NỘI DUNG` — embed STANDARD-LECTURE / STANDARD-EXERCISE / STANDARD-REVIEW / STANDARD-IELTS-TEST verbatim.
  5. `## LỘ TRÌNH IELTS TESTS` — target 50 tests, milestones: **M1** complete 01–22 (fix 18/21/22, fill 12,13,14,16,20); **M2** reach 30; **M3** reach 50.
  6. `## LỊCH HỌC HÀNG NGÀY` (reuse `plan.md` lines 156–162) updated to reference review sets on rest days.
  7. `## DAILY STUDY MIX` note: per-lesson now = lecture + vocab + 8-section exercise ≈ 3h; weekly = 1 phase review set.

- [ ] **Step 2: Verify** the framework is internally consistent and references real folders.

Run: `grep -c "lesson_" plan_v2.md && wc -l plan_v2.md`
Expected: non-zero lesson references; file ≥ 200 lines.

- [ ] **Step 3: Commit**

```bash
git add plan_v2.md
git commit -m "docs: add improved reality-aligned plan_v2 framework"
```

---

## Task 2: Refresh `STATUS.md` to true state

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1:** Rewrite the phase status table — mark Phases 1–5 **complete**. Replace the IELTS table with the real inventory (done: 01–11,15,17,19; incomplete: 18,21,22; missing: 12,13,14,16,20,23–50). Fix the stale path `/home/ncd/learnspaces/...` → `/home/ncd/workspace/learning_english` in the quick-check commands.
- [ ] **Step 2: Verify** no remaining `learnspaces` path and Phase 4/5 no longer show "thiếu".

Run: `grep -n "learnspaces\|GẦN XONG\|ĐANG LÀM" STATUS.md`
Expected: no output (all stale markers removed).

- [ ] **Step 3: Commit**

```bash
git add STATUS.md
git commit -m "docs: update STATUS.md to actual project state"
```

---

## Task 3: Improve every `lecture.md` to STANDARD-LECTURE (per-phase batches)

Applies the same pattern to all **51** lessons. Do one phase per commit. Prioritize thin files first.

**Representative files (pattern repeats across all `phase_*/lesson_*/lecture.md`):**
- `phase_4_advanced/lesson_06_vocabulary_nuances/lecture.md` (149 lines — **expand most**)
- `phase_1_foundation/lesson_01_simple_present/lecture.md` (already 324 — mainly add the 3 new sections)
- `phase_3_intermediate/lesson_01_passive_voice/lecture.md`

- [ ] **Step 1: Find under-length lectures** to prioritize.

Run: `for f in phase_*/lesson_*/lecture.md; do echo "$(wc -l <"$f") $f"; done | sort -n | head -20`
Expected: a ranked list; any < ~250 lines gets content added, not just the 3 new sections.

- [ ] **Step 2: For each lecture in the phase**, append/ensure the three new sections from STANDARD-LECTURE (`## LỖI THƯỜNG GẶP`, `## TÓM TẮT NHANH`, `## LIÊN KẾT BÀI HỌC`) and, for thin files, expand existing theory parts with more English examples until ≥280 lines. Match existing heading style exactly.

Example `## LỖI THƯỜNG GẶP` block (adapt content per lesson):

```markdown
## LỖI THƯỜNG GẶP

| Sai | Đúng | Giải thích |
|---|---|---|
| Never he has seen... | Never **has he** seen... | Đảo trợ động từ lên trước chủ ngữ sau trạng từ phủ định. |
| Hardly had X **than** Y | Hardly had X **when** Y | "Hardly ... when", không dùng "than". |
```

- [ ] **Step 3: Verify the phase** — all lectures meet the floor and contain the new sections.

Run (example for Phase 4): `for f in phase_4_advanced/lesson_*/lecture.md; do echo "$(wc -l <"$f") $(grep -c "LỖI THƯỜNG GẶP\|TÓM TẮT NHANH\|LIÊN KẾT" "$f") $f"; done`
Expected: each line shows line-count ≥ ~280 and the section-count = 3.

- [ ] **Step 4: Commit the phase**

```bash
git add phase_4_advanced/lesson_*/lecture.md
git commit -m "content: enrich Phase 4 lectures to standard (mistakes, summary, cross-links)"
```

- [ ] **Step 5:** Repeat Steps 2–4 for Phases 1, 2, 3, 5 (one commit each).

---

## Task 4: Raise every `exercise.md` to STANDARD-EXERCISE (per-phase batches)

Applies to all **51** `exercise.md`. Adds Sections G and H plus their answer-key entries. One phase per commit.

**Representative files (pattern repeats across all `phase_*/lesson_*/exercise.md`):**
- `phase_4_advanced/lesson_01_inversion/exercise.md` (currently A–F, 48 Q → add G, H)
- `phase_1_foundation/lesson_01_simple_present/exercise.md`

- [ ] **Step 1: For each exercise**, insert Section G then Section H **before** the `# ĐÁP ÁN (ANSWER KEY)` heading.

Section G template (fill transcript + blanks from the lesson topic):

```markdown
## PHẦN G: LISTENING-STYLE DICTATION / GAP-FILL (10 câu)

*Đọc đoạn văn và điền từ còn thiếu dựa vào ngữ cảnh (không cần audio).*

In recent decades, urban planners have come to (G1)_______ that green spaces
are not a luxury but a (G2)_______ ... [8–10 numbered blanks total]
```

Section H template:

```markdown
## PHẦN H: SPEAKING / DISCUSSION PROMPT

*Trả lời miệng, dùng cấu trúc/từ vựng của bài.*

1. To what extent ... ?
... (4–6 questions)

**Model answer (Band 7–8):** <one developed English paragraph using the target grammar.>
```

- [ ] **Step 2:** Extend `# ĐÁP ÁN (ANSWER KEY)` with `## PHẦN G` (the 8–10 fill answers) and `## PHẦN H (Gợi ý)` (key points the model answer should hit).

- [ ] **Step 3: Verify the phase** — every exercise has 8 sections (A–H) and answers for G/H.

Run (example Phase 4): `for f in phase_4_advanced/lesson_*/exercise.md; do echo "$(grep -c "^## PHẦN [A-H]" "$f") $f"; done`
Expected: section-count ≥ 8 in the body; confirm G and H both present.

- [ ] **Step 4: Commit the phase**

```bash
git add phase_4_advanced/lesson_*/exercise.md
git commit -m "content: add listening-style (G) and speaking (H) sections to Phase 4 exercises"
```

- [ ] **Step 5:** Repeat for Phases 1, 2, 3, 5 (one commit each).

---

## Task 5: Add cumulative `review_exercise.md` per phase (STANDARD-REVIEW)

**Files (create):**
- `phase_1_foundation/review_exercise.md`
- `phase_2_elementary/review_exercise.md`
- `phase_3_intermediate/review_exercise.md`
- `phase_4_advanced/review_exercise.md`
- `phase_5_ielts_prep/review_exercise.md`

- [ ] **Step 1: For each phase**, list its lessons (read the folder) and write 60–80 mixed-topic questions drawing from every lesson in the phase, grouped by format (MCQ / transformation / error-correction / gap-fill / translation VN→EN / short writing), then a full `# ĐÁP ÁN` section.

Header template:

```markdown
# REVIEW TỔNG HỢP — PHASE 1: FOUNDATION
## 70 Bài Tập Ôn Tập Toàn Phase (12 bài học)
*Làm sau khi hoàn thành cả phase, trước khi thi exam.*
```

- [ ] **Step 2: Verify** each review file exists, is substantial, and has an answer section.

Run: `for f in phase_*/review_exercise.md; do echo "$(wc -l <"$f") $(grep -c "ĐÁP ÁN" "$f") $f"; done`
Expected: 5 files, each ≥ ~200 lines, each with an `ĐÁP ÁN` heading.

- [ ] **Step 3: Commit**

```bash
git add phase_*/review_exercise.md
git commit -m "content: add cumulative review exercise set per phase"
```

---

## Task 6: Complete and extend IELTS practice tests (STANDARD-IELTS-TEST)

Milestone-based. Each test is its own commit (a reviewer can accept/reject one test independently).

**6a — Fix incomplete existing tests:**
- [ ] `test_18/`: create `writing.md`, `speaking.md`, `answer_key.md` (keep existing `reading.md`; align the 40 keys to it).
- [ ] `test_21/` and `test_22/`: create `answer_key.md` matching their existing `reading.md`.
- [ ] Verify: `for t in 18 21 22; do echo "test_$t: $(ls ielts_practice_tests/test_$t)"; done` → each shows all four files.
- [ ] Commit each test separately, e.g. `git commit -m "content: complete IELTS test_18 (writing, speaking, answer key)"`.

**6b — Fill gaps to make 01–22 contiguous and complete:**
- [ ] Create full 4-file sets for `test_12, test_13, test_14, test_16, test_20`.
- [ ] Verify each new test: `for t in 12 13 14 16 20; do d=ielts_practice_tests/test_$t; echo "$t $(ls $d 2>/dev/null|wc -l) files"; done` → 4 files each.
- [ ] Commit each test separately.

**6c — Extend toward 50 (milestones M2=30, M3=50):**
- [ ] Create `test_23` … `test_30` (M2), then `test_31` … `test_50` (M3), each a full 4-file set per STANDARD-IELTS-TEST, varying passage topics (science, history, environment, psychology, technology, economics) so they don't repeat.
- [ ] Per-test verification (same as 6b) and one commit per test.

**Batch verification of the whole IELTS folder:**

Run: `for d in ielts_practice_tests/test_*/; do n=$(ls "$d" | grep -c '\.md$'); echo "$(basename $d): $n md"; done | sort -V`
Expected: every present test shows 4 md files; count of complete tests rises toward 50.

---

## Verification (end-to-end)

- [ ] **Structure check — no incomplete lesson trios:**

```bash
for d in phase_*/lesson_*/; do c=$(ls "$d"/*.md 2>/dev/null | wc -l); [ "$c" -lt 3 ] && echo "INCOMPLETE: $d ($c)"; done; echo "trio check done"
```
Expected: only "trio check done" (no INCOMPLETE lines).

- [ ] **Exercise quota check — every exercise has Sections G & H:**

```bash
for f in phase_*/lesson_*/exercise.md; do grep -q "PHẦN G" "$f" && grep -q "PHẦN H" "$f" || echo "MISSING G/H: $f"; done; echo "exercise check done"
```
Expected: only "exercise check done".

- [ ] **Lecture standard check — every lecture has the 3 new sections:**

```bash
for f in phase_*/lesson_*/lecture.md; do grep -q "LỖI THƯỜNG GẶP" "$f" && grep -q "TÓM TẮT NHANH" "$f" || echo "LECTURE GAP: $f"; done; echo "lecture check done"
```
Expected: only "lecture check done".

- [ ] **Review sets present:** `ls phase_*/review_exercise.md | wc -l` → `5`.

- [ ] **IELTS completeness:** rerun the 6c batch command; confirm targeted tests have 4 md files each.

- [ ] **Quarto render smoke test (optional, confirms Markdown is valid):**

```bash
quarto render plan_v2.md --to pdf
```
Expected: produces `plan_v2.pdf` with no render error. (Skip if Quarto/TeX not installed; not required for content correctness.)

---

## Self-Review notes

- **Spec coverage:** improved framework (Task 1) ✓ improve lectures (Task 3) ✓ raise exercise quota (Task 4) ✓ cumulative reviews (Task 5) ✓ more IELTS tests (Task 6) ✓.
- **Sequencing:** Task 1 defines the standards Tasks 3–6 consume — do Task 1 first. Tasks 3, 4, 5, 6 are independent of each other and can be parallelized by phase/test.
- **No placeholders:** every content task carries a concrete template and a runnable verification command. Exact question wording inside each lesson is authored at execution time from the lesson's own topic (intentionally not pre-written for 51 lessons), but the structure, counts, and answer-key requirement are fully specified.
