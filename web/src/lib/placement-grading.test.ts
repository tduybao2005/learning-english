import { describe, it, expect } from "vitest";

import { gradePlacementSection } from "./placement-grading";

const q = (id: string, normalized: string) => ({
  id,
  kind: "FILL_BLANK" as const,
  isOpenEnded: false,
  variants: [{ normalized }],
});

describe("gradePlacementSection", () => {
  it("scores only listed questions and ignores unknown ids", () => {
    const out = gradePlacementSection([q("a", "cat"), q("b", "dog")], {
      a: "cat",
      b: "wrong",
      z: "cat",
    });
    expect(out.rawScore).toBe(1);
    expect(out.results.z).toBeUndefined();
    expect(out.results.b.isCorrect).toBe(false);
    expect(out.results.a.isCorrect).toBe(true);
  });

  it("treats a missing answer as blank/incorrect", () => {
    const out = gradePlacementSection([q("a", "cat")], {});
    expect(out.rawScore).toBe(0);
    expect(out.results.a).toEqual({ text: "", isCorrect: false });
  });
});
