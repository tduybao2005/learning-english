import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { listLessons, PHASE_META } from "./parse-lesson";

let root: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-fixture-"));

  const write = (rel: string, content: string) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };

  write(
    "phase_1_foundation/lesson_01_simple_present/lecture.md",
    "# BÀI 1: THÌ HIỆN TẠI ĐƠN (SIMPLE PRESENT TENSE)\n\n## GIỚI THIỆU\n"
  );
  write("phase_1_foundation/lesson_01_simple_present/vocabulary.md", "# VOCABULARY\n");
  write("phase_1_foundation/lesson_01_simple_present/exercise.md", "# EXERCISE\n");

  write(
    "phase_1_foundation/lesson_02_present_continuous/lecture.md",
    "# BÀI 2: THÌ HIỆN TẠI TIẾP DIỄN\n"
  );
  write("phase_1_foundation/lesson_02_present_continuous/vocabulary.md", "# VOCABULARY\n");
  write("phase_1_foundation/lesson_02_present_continuous/exercise.md", "# EXERCISE\n");

  // A non-lesson directory (e.g. real corpus has "exam") must be ignored.
  write("phase_1_foundation/exam/placement.md", "# EXAM\n");

  write(
    "phase_2_elementary/lesson_01_past_continuous/lecture.md",
    "# BÀI 1: THÌ QUÁ KHỨ TIẾP DIỄN\n"
  );
  write("phase_2_elementary/lesson_01_past_continuous/vocabulary.md", "# VOCABULARY\n");
  write("phase_2_elementary/lesson_01_past_continuous/exercise.md", "# EXERCISE\n");
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("listLessons", () => {
  it("finds lessons across phases, sorted by phase then lesson order", () => {
    const lessons = listLessons(root);
    expect(lessons).toHaveLength(3);
    expect(lessons.map((l) => `${l.phaseSlug}/${l.lessonSlug}`)).toEqual([
      "phase_1_foundation/lesson_01_simple_present",
      "phase_1_foundation/lesson_02_present_continuous",
      "phase_2_elementary/lesson_01_past_continuous",
    ]);
  });

  it("parses phase and lesson order from directory names", () => {
    const [first, , third] = listLessons(root);
    expect(first.phaseOrder).toBe(1);
    expect(first.lessonOrder).toBe(1);
    expect(third.phaseOrder).toBe(2);
    expect(third.lessonOrder).toBe(1);
  });

  it("derives title from the first '# ' heading of lecture.md", () => {
    const [first] = listLessons(root);
    expect(first.title).toBe("BÀI 1: THÌ HIỆN TẠI ĐƠN (SIMPLE PRESENT TENSE)");
  });

  it("ignores non lesson_* directories such as 'exam'", () => {
    const lessons = listLessons(root);
    expect(lessons.some((l) => l.lessonSlug === "exam")).toBe(false);
  });

  it("includes the lesson's directory path", () => {
    const [first] = listLessons(root);
    expect(first.dir).toBe(path.join(root, "phase_1_foundation", "lesson_01_simple_present"));
  });
});

describe("PHASE_META", () => {
  it("has an entry for every phase slug used in the real corpus", () => {
    for (const slug of [
      "phase_1_foundation",
      "phase_2_elementary",
      "phase_3_intermediate",
      "phase_4_advanced",
      "phase_5_ielts_prep",
    ]) {
      expect(PHASE_META[slug]).toBeDefined();
      expect(PHASE_META[slug].title).toMatch(/Giai đoạn/);
      expect(PHASE_META[slug].cefrLabel).toBeTruthy();
    }
  });
});
