import { describe, expect, it } from "vitest";
import { gradeExample } from "./example-grading";
import type { LectureExample } from "./lecture-examples";

const EX: LectureExample = {
  id: "sp-2",
  prompt: "They ___ (not / like) coffee.",
  hint: "Phủ định.",
  answer: "don't like / do not like",
  variants: ["don't like", "do not like"],
};

describe("gradeExample", () => {
  it("accepts an exact variant (case/punctuation-insensitive)", () => {
    expect(gradeExample(EX, "  Don't like.", false)).toMatchObject({
      correct: true,
      answer: "don't like / do not like",
    });
  });

  it("accepts contraction-equivalent forms not listed verbatim", () => {
    const ex = { ...EX, answer: "don't like", variants: ["don't like"] };
    expect(gradeExample(ex, "do not like", false)).toMatchObject({ correct: true });
  });

  it("rejects a wrong answer without leaking the answer", () => {
    const res = gradeExample(EX, "doesn't likes", false);
    expect(res).toEqual({ correct: false });
    expect(JSON.stringify(res)).not.toContain("like");
  });

  it("rejects empty input", () => {
    expect(gradeExample(EX, "   ", false)).toEqual({ correct: false });
  });

  it("returns the raw answer on reveal regardless of input", () => {
    expect(gradeExample(EX, "", true)).toEqual({
      revealed: true,
      answer: "don't like / do not like",
    });
  });
});
