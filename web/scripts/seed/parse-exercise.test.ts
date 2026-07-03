import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseExercise } from "./parse-exercise";

const repoRoot = path.resolve(process.cwd(), "..");
function fixture(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("parseExercise — lesson_01_simple_present (filled-blanks quirk)", () => {
  const parsed = parseExercise(
    fixture("phase_1_foundation/lesson_01_simple_present/exercise.md")
  );

  it("splits into 5 sections A–E", () => {
    expect(parsed.sections.map((s) => s.label)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("Section A is FILL_BLANK", () => {
    expect(parsed.sections[0].kind).toBe("FILL_BLANK");
  });

  it("Q1 prompt keeps a blank and does NOT leak the filled answer 'cooks'", () => {
    const q1 = parsed.sections[0].questions.find((q) => q.number === 1)!;
    expect(q1.prompt).toContain("______");
    // the raw file has "______cooks______" filled in — must be scrubbed
    expect(q1.prompt).not.toMatch(/_cooks_/);
    expect(q1.prompt).not.toMatch(/______cooks/);
  });

  it("Q1 variants include 'cooks'", () => {
    const q1 = parsed.sections[0].questions.find((q) => q.number === 1)!;
    expect(q1.variants.map((v) => v.text)).toContain("cooks");
  });

  it("Q2 (two blanks) has a single slash-joined variant 'opens / closes'", () => {
    const q2 = parsed.sections[0].questions.find((q) => q.number === 2)!;
    expect(q2.variants.map((v) => v.text)).toContain("opens / closes");
  });

  it("Section B is MULTIPLE_CHOICE; Q16 has 4 options, variant 'B', keyNote 'teaches'", () => {
    const secB = parsed.sections[1];
    expect(secB.kind).toBe("MULTIPLE_CHOICE");
    const q16 = secB.questions.find((q) => q.number === 16)!;
    expect(q16.options).toHaveLength(4);
    expect(q16.variants.map((v) => v.text)).toContain("B");
    expect(q16.keyNote).toBe("teaches");
  });

  it("Section D Q34 variants include 'go'", () => {
    const secD = parsed.sections.find((s) => s.label === "D")!;
    const q34 = secD.questions.find((q) => q.number === 34)!;
    expect(q34.variants.map((v) => v.text)).toContain("go");
  });

  it("Section E (Sample Answers) is open-ended with the sample in answerRaw and one variant", () => {
    const secE = parsed.sections.find((s) => s.label === "E")!;
    expect(secE.questions.length).toBeGreaterThan(0);
    for (const q of secE.questions) {
      expect(q.isOpenEnded).toBe(true);
      expect(q.answerRaw.length).toBeGreaterThan(0);
      expect(q.variants.length).toBe(1);
    }
    const q41 = secE.questions.find((q) => q.number === 41)!;
    expect(q41.answerRaw.toLowerCase()).toContain("wakes up");
  });
});

describe("parseExercise — lesson_02_present_continuous (canonical)", () => {
  const parsed = parseExercise(
    fixture("phase_1_foundation/lesson_02_present_continuous/exercise.md")
  );

  it("body section count matches the answer-key section count (5)", () => {
    expect(parsed.sections).toHaveLength(5);
    expect(parsed.sections.map((s) => s.label)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("every section has at least one question", () => {
    for (const s of parsed.sections) {
      expect(s.questions.length).toBeGreaterThan(0);
    }
  });

  it("Section A Q13 gets the slash-joined two-blank variant 'Is / coming'", () => {
    const secA = parsed.sections[0];
    const q13 = secA.questions.find((q) => q.number === 13)!;
    expect(q13.variants.map((v) => v.normalized)).toContain("is / coming");
  });
});

describe("parseExercise — phase3 lesson_01_passive_voice (worst-case headings)", () => {
  const parsed = parseExercise(
    fixture("phase_3_intermediate/lesson_01_passive_voice/exercise.md")
  );

  it("finds the answer-key boundary despite repeated '## SECTION A' headings after the divider", () => {
    // body has 6 sections A–F; the key repeats '## SECTION A'.. headings which
    // must NOT be mistaken for body sections.
    expect(parsed.sections.map((s) => s.label)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("every parsed question has >=1 variant OR isOpenEnded", () => {
    for (const s of parsed.sections) {
      expect(s.questions.length).toBeGreaterThan(0);
      for (const q of s.questions) {
        expect(q.isOpenEnded || q.variants.length >= 1).toBe(true);
      }
    }
  });

  it("bold '**A1.**'-style markers are parsed (A section has 13 questions)", () => {
    const secA = parsed.sections[0];
    expect(secA.kind).toBe("FILL_BLANK");
    expect(secA.questions).toHaveLength(13);
    const a1 = secA.questions[0];
    expect(a1.variants.map((v) => v.text)).toContain("was built");
  });

  it("Section E and F (Gợi ý / writing) are open-ended", () => {
    const secE = parsed.sections.find((s) => s.label === "E")!;
    const secF = parsed.sections.find((s) => s.label === "F")!;
    expect(secE.questions.every((q) => q.isOpenEnded)).toBe(true);
    expect(secF.kind).toBe("OPEN_WRITING");
    expect(secF.questions.every((q) => q.isOpenEnded)).toBe(true);
  });
});
