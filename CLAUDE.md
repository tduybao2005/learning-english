# CLAUDE.md — Agent Guide

Bilingual (Vietnamese/English) self-study English curriculum targeting IELTS
6.5–8.0, plus the **Next.js web app under `web/`** that serves it. The Markdown
under `phase_*/`, `ielts_practice_tests/` and `toeic_practice_tests/` is the
single source of truth; the app seeds it into Postgres and never writes back.
Runtime is self-hosted Docker Compose behind a Cloudflare tunnel — see
`docs/architecture.md`.

## Start here

1. **Discovery:** read `index/manifest.json` — complete inventory of all
   phases, lessons, exams, and IELTS tests with titles, topics, and
   completeness flags. Human-readable version: `docs/STATUS.md`.
2. **File formats:** `docs/content-model.md` (schemas, answer-key
   conventions, known quirks). Architecture: `docs/architecture.md`.
   Flows: `docs/data-flow.md`.
3. Every content file has YAML frontmatter (`type`, `phase`/`test`, `topic`,
   `cefr`, `title`) — identify files without reading bodies.

## Layout

- `phase_<N>_<name>/lesson_<NN>_<slug>/` — `lecture.md` + `vocabulary.md` +
  `exercise.md` (answer key embedded; heading varies — search `ANSWER KEY` or
  `ĐÁP ÁN` in H1–H3, see docs/content-model.md; phase-5 writing/speaking
  exercises use inline `Gợi ý` model answers instead).
  Phases 1–5 map to CEFR A1-A2 → C1.
- `phase_<N>_<name>/exam/` — `phase<N>_exam.md` + `phase<N>_answer_key.md`.
- `ielts_practice_tests/test_<NN>/` — `reading.md`, `writing.md`,
  `speaking.md`, `answer_key.md` (test_01–test_30, all complete).
- `toeic_practice_tests/test_<NN>/` — `listening.md` (placeholder, no
  content yet), `reading.md`, `speaking.md`, `writing.md`, `answer_key.md`.
- `vocab_topics/` — side-car taxonomy that groups every vocabulary word into
  one of 37 real-world topics, independent of which lesson it came from:
  `topics.tsv` (`slug name_vi name_en emoji group order_index`, groups
  EVERYDAY / ACADEMIC / FUNCTIONAL) and `mapping.tsv` (`word topic_slug`,
  keyed on the lowercased word alone). Not derived from the Markdown — it is
  hand-curated and checked against it by `make check-vocab`.
- Chủ đề **bài học** (khác chủ đề từ vựng) không có file nguồn: taxonomy 52
  bài → 15 chủ đề nằm ở `web/src/lib/lesson-topics.ts` dưới dạng hằng số
  TypeScript, có `lesson-topics.test.ts` làm cổng kiểm tra. Thêm/xoá thư mục
  `lesson_*` thì phải cập nhật cả hai, nếu không `npm test` sẽ đỏ.
- `scripts/` — stdlib-Python tooling; `docs/` — knowledge base;
  `docs/plans/` — historical plans (frozen, don't update).
- `docs/design/` — the app's visual design system exports (self-contained,
  survive Claude-account changes): `code-export/` (design-system tokens +
  reference component code + screen shots + a ready-to-paste
  `CLAUDE_CODE_PROMPT.md`), `ux-refinements-export/`, `webapp-export/`. When
  doing any UI/design work, read the relevant `*_PROMPT.md` and its
  `*.dc.html` + `screens/` first and follow that system (indigo-violet
  primary + coral accent, Vietnamese UI copy).

## Commands

Content tooling (repo root, stdlib Python):

```bash
python3 -m unittest discover -s scripts/tests -v   # test the tooling
python3 scripts/add_frontmatter.py                 # frontmatter new content (idempotent)
python3 scripts/build_index.py                     # regenerate manifest + docs/STATUS.md
python3 scripts/build_index.py --check             # validate; exit 1 on drift
quarto render <file.md> --to pdf                   # PDF of one file (Quarto 1.6)
```

The app (`cd web/`, npm):

```bash
npm test                    # Vitest; tests are co-located next to the source
npm run lint
npm run db:migrate          # prisma migrate dev (local, against .env.local)
```

The self-hosted runtime (repo root, Docker Compose):

```bash
make bootstrap   # first run: build, start db+web, migrate, seed everything
make up | down | logs | ps
make migrate     # prisma migrate deploy inside the web container
make seed-all    # ingest lessons/vocab/exercises + placement + IELTS + backfill audioUrl
make check-vocab # cổng kiểm tra vocab_topics/ (exit 1 nếu còn từ chưa phân loại)
make dbsh        # psql into the db container
```

**Từ vựng theo chủ đề** — `/vocab` duyệt theo 37 chủ đề trong `vocab_topics/`,
KHÔNG theo bài; trang bài học vẫn còn nhưng chỉ là lối vào phụ. Sửa
`vocab_topics/*.tsv` xong phải chạy `make check-vocab` rồi `make seed-all`:
ingest có một lượt đồng bộ `topicId` chạy độc lập với `contentHash`, nên nó
gán lại toàn bộ — kể cả các bài không đổi nội dung — và **xoá `topicId` của
những từ không còn trong mapping**. Vì thế `web/Dockerfile` phải COPY
`vocab_topics/` vào image; thiếu là lần seed kế tiếp quét sạch chủ đề của cả
kho (loadVocabTopics nay ném lỗi thay vì im lặng, nhưng đừng bỏ dòng COPY).

**Âm thanh** — SFX ở `web/public/sounds/` (sinh bằng `python3 web/scripts/make-sfx.py`),
phát âm từ vựng ở `web/public/audio/vocab/<slug>.mp3` (giọng `en-GB-LibbyNeural`).
Thêm từ vựng mới thì phải sinh audio **ở host** (container không có `edge-tts`):

```bash
cd web && npm run audio:vocab   # sinh mp3 còn thiếu + ghi VocabWord.audioUrl
cd .. && make up                # build lại image kèm file mới
```

Trả lời ĐÚNG ở phần luyện tập từ vựng phát **file phát âm của chính từ đó**
(`playWordAudio` trong `web/src/lib/audio/word-audio.ts`), không phải SFX
"correct" — phản hồi đó vừa xác nhận vừa dạy cách đọc. Trả lời SAI vẫn dùng
`playSfx("wrong")`, nhưng phải gọi `stopWordAudio()` trước: giọng đọc dài cỡ
một giây sẽ lấp mất tiếng báo lỗi ngắn 0,46s. Từ chưa có `audioUrl` thì im
lặng chứ không quay lại tiếng ting. `VOICE_VERSION` trong `word-audio.ts`
phải khớp với `PronounceButton.tsx`.

Seed vocab là delete+create, nên `VocabWord.audioUrl` bị xoá sau mỗi lần seed —
`make seed-all` đã tự chạy lại bước backfill; đừng bỏ bước đó đi.

**Môi trường test cách ly** (repo root) — dùng khi code tính năng mới hay đổi
schema. Compose project riêng, port riêng, DB ephemeral, không có Cloudflare
tunnel, **không đụng port/dữ liệu của stack prod** (`docs/test-environment.md`):

```bash
make test-up     # dựng db+web test, migrate, seed → http://localhost:3100
make test-unit   # migrate + seed + vitest trong container, trên DB sạch
make test-reset  # dựng lại từ DB trắng
make test-down   # xoá stack test (DB tmpfs bay theo)
```

## Hard rules

- **Never modify exercise/exam/answer-key content when grading** — grading
  writes a new `score_report_<YYYY-MM-DD>.md` into the same folder
  (see `.claude/skills/grading-english-exercises/SKILL.md`).
- **Never invent answers**; answer keys are the only source of truth.
  Variants separated by `/` are all correct.
- **IELTS tests are scored on band 0–9** using that test's own raw→band
  table in its `answer_key.md` — never percentages, never another test's table.
- **Chỉ 20/30 đề IELTS chấm được trong app** (`VERIFIED_READING_TESTS` trong
  `web/scripts/seed/parse-ielts-reading.ts`, dựa trên `scripts/check_ielts_keys.py`).
  10 đề còn lại có answer key trả lời những câu mà chính đề không hỏi — trang giữ
  ở dạng đọc, API trả 409. Đừng nới danh sách này nếu chưa chạy lại cổng kiểm tra.
- **TOEIC L&R chấm theo scaled score 5–495 mỗi kỹ năng** bằng bảng quy đổi
  của chính đề đó — không phần trăm, không band IELTS, không mượn bảng đề
  khác. Speaking/Writing chấm 0–200 theo rubric trong `answer_key.md`.
  Listening chưa có audio → ghi "chưa thi", không chấm 0.
- **Đừng gán chủ đề từ vựng theo TÊN NHÓM trong `vocabulary.md`** — phải xét
  nghĩa từng từ. Cách gán cả nhóm đã hai lần đẩy nhầm từ vào chủ đề sai
  ("bad"/"beautiful" vào So sánh & Đối chiếu; "yawn"/"survey" vào Thời gian)
  và phải revert. Gán xong một lô thì bốc mẫu vài chục từ mỗi chủ đề để soi
  trước khi commit.
- **Lộ trình không còn khoá bài.** `/learn` duyệt theo chủ đề, mọi bài đều
  vào được; `LessonProgress` vẫn ghi như cũ nhưng chỉ dùng để HIỂN THỊ tiến
  độ. Đừng thêm lại `if (state === "LOCKED") redirect(...)` vào các trang
  dưới `learn/[phase]/[lesson]/` — có năm chỗ như vậy đã bị xoá có chủ đích.
- **`SKIPPED` không phải "đã học".** Bài kiểm tra đầu vào ghi SKIPPED cho mọi
  bài trước điểm được xếp; gộp nó vào tiến độ thì người vừa thi xong đã thấy
  "đã học 23/52 bài". Cả `/learn` lẫn `/dashboard` chỉ đếm `COMPLETED`.
- **Keep the bilingual convention**: Vietnamese headings/framing, English
  examples and explanations. Don't translate existing content.
- After adding/removing content files, rerun `python3 scripts/build_index.py`
  and commit the regenerated `index/manifest.json` + `docs/STATUS.md`.
- Work happens directly on `main`.
- Run only one sub agent

## Grading a learner's answers

Use the `grading-english-exercises` skill. Locator table:
lesson → key embedded in `exercise.md`; phase exam →
`phase_*/exam/phase<N>_answer_key.md`; IELTS → `test_<NN>/answer_key.md`;
TOEIC → `toeic_practice_tests/test_<NN>/answer_key.md`.
