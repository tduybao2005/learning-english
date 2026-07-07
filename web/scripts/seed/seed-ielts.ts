import fs from "fs";
import path from "path";

import { db } from "../../src/lib/db";
import { stripFrontmatter } from "./strip-frontmatter";

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

  for (const { name, number } of testDirs) {
    const dir = path.join(TESTS_DIR, name);
    const readingMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "reading.md")));
    const writingMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "writing.md")));
    const speakingMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "speaking.md")));
    const answerKeyMd = stripFrontmatter(readFileOrEmpty(path.join(dir, "answer_key.md")));

    const isComplete = [readingMd, writingMd, speakingMd, answerKeyMd].every(isSubstantial);
    if (isComplete) completeCount++;
    else incompleteCount++;

    await db.ieltsTest.upsert({
      where: { number },
      create: { number, readingMd, writingMd, speakingMd, answerKeyMd, isComplete },
      update: { readingMd, writingMd, speakingMd, answerKeyMd, isComplete },
    });

    console.log(
      `[seed-ielts] test_${String(number).padStart(2, "0")}: ` +
        `reading=${readingMd.length}B writing=${writingMd.length}B ` +
        `speaking=${speakingMd.length}B answer_key=${answerKeyMd.length}B ` +
        `isComplete=${isComplete}`,
    );
  }

  console.log(
    `[seed-ielts] done: ${testDirs.length} tests upserted ` +
      `(${completeCount} complete, ${incompleteCount} incomplete)`,
  );

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
