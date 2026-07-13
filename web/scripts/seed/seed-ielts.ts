import fs from "fs";
import path from "path";

import type { Prisma } from "@prisma/client";

import { db } from "../../src/lib/db";
import { stripFrontmatter } from "./strip-frontmatter";
import {
  parseIeltsReading,
  VERIFIED_READING_TESTS,
  type ParsedIeltsQuestion,
} from "./parse-ielts-reading";
import { normalize } from "../../src/lib/grading/normalize";

/**
 * Seeds `IeltsTest` rows from `ielts_practice_tests/test_NN/` at the repo
 * root — one level above `web/` (same `REPO_ROOT` convention as
 * `seed-placement.ts`).
 *
 * ## `isComplete` heuristic
 *
 * The task brief pointed at `STATUS.md` (repo root) for a documented
 * "incomplete" convention before inventing a threshold. `STATUS.md` (dated
 * 2026-06-28) lists test_12-14, 16, 18, 20-30 as missing files/thin content
 * at that time. But `git log -- ielts_practice_tests` shows commits after
 * that date — "content: complete IELTS test_12" through "test_30" — that
 * filled in every one of those tests. Byte-count and spot-read checks
 * confirm all 30 test directories now have all 4 files
 * (reading/writing/speaking/answer_key.md) with substantial real content
 * (tens of KB each, not stubs). So `STATUS.md`'s specific list is stale
 * documentation of a past state, not a current convention — exactly why the
 * brief says to detect completeness by file presence + non-empty content
 * rather than hardcoding that stale list.
 *
 * A test is `isComplete` iff all 4 files exist AND each has more than
 * `MIN_CONTENT_LENGTH` characters of trimmed content. The threshold only
 * needs to be high enough to reject a genuinely missing/stub file (empty
 * string, or a bare heading with no body) — every real file in the current
 * corpus clears it by a wide margin (smallest is ~4.2KB), so this isn't a
 * near-miss threshold tuned to the data, just a sanity floor.
 */

const MIN_CONTENT_LENGTH = 200;

const REPO_ROOT = path.resolve(process.cwd(), "..");
const TESTS_DIR = path.join(REPO_ROOT, "ielts_practice_tests");

const TEST_DIR_RE = /^test_(\d+)$/;

function readFileOrEmpty(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

function isSubstantial(content: string): boolean {
  return content.trim().length > MIN_CONTENT_LENGTH;
}

interface BandTableRow {
  min: number;
  band: number;
}

/**
 * Reads the raw→band table out of THIS test's own answer_key.md.
 *
 * Hard rule from CLAUDE.md: an IELTS test is scored with its own table, never a
 * percentage and never another test's table — so a missing table is a hard
 * failure, not a reason to fall back to a neighbour's.
 *
 * Rows look like `| 30–32 | 7.0 |`: the low end of the range is the threshold
 * `rawToBand()` compares against (raw >= min → that band).
 */
function extractReadingBandTable(answerKeyMd: string, testNumber: number): BandTableRow[] {
  // Mỗi đề viết tiêu đề một kiểu: "## READING BAND SCORE CONVERSION",
  // "### Bảng quy đổi điểm — Reading", "## BAND SCORE CONVERSION"... nên dò theo
  // Ý NGHĨA (heading nào nói về band/quy đổi) rồi mới xác thực bằng nội dung
  // bảng, thay vì khớp cứng một chuỗi.
  const headingRe = /^#{2,4}[^\n]*(band|quy đổi)[^\n]*$/gim;
  const candidates: { heading: string; rows: BandTableRow[] }[] = [];

  let h: RegExpExecArray | null;
  while ((h = headingRe.exec(answerKeyMd))) {
    const rest = answerKeyMd.slice(h.index + h[0].length);
    const nextHeading = rest.search(/^#{1,4}\s/m);
    const block = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

    const rows: BandTableRow[] = [];
    const rowRe = /^\|\s*(\d+)(?:\s*[–—-]\s*\d+)?\s*\|\s*([\d.]+)\s*\|/gm;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(block))) {
      const min = parseInt(m[1], 10);
      const band = parseFloat(m[2]);
      if (Number.isFinite(min) && Number.isFinite(band)) rows.push({ min, band });
    }
    // Một bảng raw→band của Reading: điểm thô nằm trong 0..40 và band trong 0..9.
    const plausible =
      rows.length >= 5 &&
      rows.every((r) => r.min >= 0 && r.min <= 40 && r.band >= 0 && r.band <= 9);
    if (plausible) candidates.push({ heading: h[0].trim(), rows });
  }

  if (candidates.length === 0) {
    throw new Error(`[seed-ielts] test_${testNumber}: no raw→band table found in answer_key.md`);
  }
  // Nếu đề có nhiều bảng (ví dụ thêm bảng Listening), lấy đúng bảng của Reading.
  const reading = candidates.find((c) => /reading/i.test(c.heading));
  const chosen = reading ?? candidates[0];
  return [...chosen.rows].sort((a, b) => a.min - b.min);
}

/**
 * Writes the parsed Reading paper into Section/Question/AnswerVariant.
 *
 * Sections exist because `Section.kind` is a single QuestionKind, while a
 * Reading paper mixes MCQ groups and completion groups. So we cut the 40
 * questions into runs of the same kind — one Section per run, in paper order.
 * Numbers stay global (1..40), which is what the answer key and the UI use.
 *
 * Delete-then-recreate: `Question` is the parent of `IeltsAnswer`, so re-seeding
 * a test throws away attempts on it. That is the same trade the lesson ingest
 * already makes, and re-seeding is a content operation, not a user operation.
 */
async function seedReadingQuestions(
  ieltsTestId: string,
  testNumber: number,
  questions: ParsedIeltsQuestion[],
): Promise<number> {
  await db.section.deleteMany({ where: { ieltsTestId } });

  let written = 0;
  let runStart = 0;

  while (runStart < questions.length) {
    const kind = questions[runStart].kind;
    let runEnd = runStart;
    while (runEnd + 1 < questions.length && questions[runEnd + 1].kind === kind) runEnd++;

    const run = questions.slice(runStart, runEnd + 1);
    const first = run[0];
    const last = run[run.length - 1];
    const orderIndex = runStart;

    const section = await db.section.create({
      data: {
        ieltsTestId,
        label: String.fromCharCode(65 + orderIndex), // "A", "B", ... — chỉ để hiển thị
        title: `Questions ${first.number}–${last.number}`,
        kind,
        instructions: null,
        orderIndex,
      },
    });

    for (const q of run) {
      await db.question.create({
        data: {
          sectionId: section.id,
          number: q.number,
          prompt: q.prompt,
          options: (q.options ?? undefined) as Prisma.InputJsonValue | undefined,
          answerRaw: q.answerRaw,
          keyNote: q.explanation,
          isOpenEnded: false,
          variants: {
            create: q.variants.map((v) => ({
              text: v.text,
              normalized: normalize(v.text),
            })),
          },
        },
      });
      written++;
    }

    runStart = runEnd + 1;
  }

  if (written !== 40) {
    throw new Error(`[seed-ielts] test_${testNumber}: wrote ${written} questions, expected 40`);
  }
  return written;
}

async function main() {
  if (!fs.existsSync(TESTS_DIR)) {
    throw new Error(`[seed-ielts] TESTS_DIR not found: ${TESTS_DIR}`);
  }

  // Don't hardcode 30 — discover whatever test_NN directories actually exist.
  const testDirs = fs
    .readdirSync(TESTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && TEST_DIR_RE.test(d.name))
    .map((d) => ({ name: d.name, number: Number(TEST_DIR_RE.exec(d.name)![1]) }))
    .sort((a, b) => a.number - b.number);

  if (testDirs.length === 0) {
    throw new Error(`[seed-ielts] no test_NN directories found under ${TESTS_DIR}`);
  }

  let completeCount = 0;
  let incompleteCount = 0;
  let verifiedCount = 0;
  let totalQuestions = 0;

  for (const { name, number } of testDirs) {
    const dir = path.join(TESTS_DIR, name);
    const readingMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "reading.md")));
    const writingMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "writing.md")));
    const speakingMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "speaking.md")));
    const answerKeyMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "answer_key.md")));

    const isComplete = [readingMd, writingMd, speakingMd, answerKeyMd].every(isSubstantial);
    if (isComplete) completeCount++;
    else incompleteCount++;

    // Chỉ 20 đề đã qua cổng kiểm tra key mới được chấm. 10 đề còn lại vẫn được
    // upsert (để đọc), nhưng KHÔNG có câu hỏi và readingKeyVerified = false.
    const verified = VERIFIED_READING_TESTS.includes(number);
    const bandTable = verified ? extractReadingBandTable(answerKeyMd, number) : null;

    const test = await db.ieltsTest.upsert({
      where: { number },
      create: {
        number,
        readingMd,
        writingMd,
        speakingMd,
        answerKeyMd,
        isComplete,
        readingKeyVerified: verified,
        bandTable: (bandTable ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      update: {
        readingMd,
        writingMd,
        speakingMd,
        answerKeyMd,
        isComplete,
        readingKeyVerified: verified,
        bandTable: (bandTable ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    let questionCount = 0;
    if (verified) {
      const parsed = parseIeltsReading(readingMd, answerKeyMd);
      // Đề nằm trong danh sách đã xác minh mà parser lại không đọc được => hoặc
      // nội dung vừa bị sửa, hoặc parser hỏng. Dừng hẳn, đừng seed đề nửa vời.
      if (!parsed.usable || parsed.questions.length !== 40) {
        throw new Error(
          `[seed-ielts] test_${number} is in VERIFIED_READING_TESTS but parsed to ` +
            `${parsed.questions.length} questions (usable=${parsed.usable}): ` +
            parsed.problems.join("; "),
        );
      }
      questionCount = await seedReadingQuestions(test.id, number, parsed.questions);
      totalQuestions += questionCount;
      verifiedCount++;
    } else {
      // Đề chưa xác minh: dọn sạch câu hỏi cũ (nếu từng seed nhầm) để API chấm
      // không bao giờ có gì để chấm.
      await db.section.deleteMany({ where: { ieltsTestId: test.id } });
    }

    console.log(
      `[seed-ielts] test_${String(number).padStart(2, "0")}: ` +
        `reading=${readingMd.length}B writing=${writingMd.length}B ` +
        `speaking=${speakingMd.length}B answer_key=${answerKeyMd.length}B ` +
        `isComplete=${isComplete} verified=${verified} questions=${questionCount}`,
    );
  }

  console.log(
    `[seed-ielts] done: ${testDirs.length} tests upserted ` +
      `(${completeCount} complete, ${incompleteCount} incomplete); ` +
      `${verifiedCount} gradeable with ${totalQuestions} Reading questions`,
  );

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
