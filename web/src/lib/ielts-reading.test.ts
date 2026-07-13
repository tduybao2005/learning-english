import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { splitReadingSections, splitReadingPaper } from "./ielts-reading";

const REPO_ROOT = path.resolve(process.cwd(), "..");

const MD = `# IELTS Academic Reading — Test 05

Rubric intro line.

## READING PASSAGE 1

### Beyond the Stars

Paragraph A text.

## QUESTIONS 1–13

### Questions 1–5

Do the following statements agree...

## READING PASSAGE 2

Passage two body.

## QUESTIONS 14–26

More questions.
`;

describe("splitReadingSections", () => {
  it("pairs each passage with its questions", () => {
    const out = splitReadingSections(MD);
    expect(out).not.toBeNull();
    expect(out!.pairs).toHaveLength(2);
    expect(out!.intro).toContain("Rubric intro line.");
    expect(out!.pairs[0].passageMd).toContain("Paragraph A text.");
    expect(out!.pairs[0].questionsMd).toContain("Questions 1–5");
    expect(out!.pairs[1].questionsMd).toContain("More questions.");
    expect(out!.pairs[0].passageMd).not.toContain("More questions.");
  });
  it("returns null for markdown without the passage/questions structure", () => {
    expect(splitReadingSections("# Just a title\n\nSome text.")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(splitReadingSections("")).toBeNull();
  });
});

describe("splitReadingPaper — trên 20 đề thật, không phải fixture bịa", () => {
  const USABLE = [2, 3, 4, 7, 8, 12, 13, 14, 16, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];

  for (const n of USABLE) {
    const nn = String(n).padStart(2, "0");

    it(`test_${nn}: các nhóm câu hỏi phủ đúng 1..40 và đều có hướng dẫn`, () => {
      const md = fs.readFileSync(
        path.join(REPO_ROOT, "ielts_practice_tests", `test_${nn}`, "reading.md"),
        "utf-8",
      );
      const paper = splitReadingPaper(md);
      expect(paper).not.toBeNull();

      const groups = paper!.passages.flatMap((p) => p.groups);
      const covered = groups.flatMap((g) =>
        Array.from({ length: g.to - g.from + 1 }, (_, i) => g.from + i),
      );
      expect([...new Set(covered)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 1),
      );

      // Bài đọc không được rỗng, và hướng dẫn của mỗi nhóm cũng vậy — hướng dẫn
      // là nơi chứa ràng buộc số từ / danh sách heading.
      for (const p of paper!.passages) expect(p.passageMd.length).toBeGreaterThan(200);
      for (const g of groups) expect(g.instructionsMd.trim().length).toBeGreaterThan(0);
    });
  }

  it("không nuốt câu hỏi vào phần hướng dẫn", () => {
    const md = fs.readFileSync(
      path.join(REPO_ROOT, "ielts_practice_tests", "test_07", "reading.md"),
      "utf-8",
    );
    const first = splitReadingPaper(md)!.passages[0].groups[0];
    expect(first.instructionsMd).not.toMatch(/^\s*(?:\*\*)?1(?:\*\*)?\s*[.)|:]/m);
  });
});
