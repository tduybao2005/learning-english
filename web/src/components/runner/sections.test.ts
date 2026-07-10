import { describe, expect, it } from "vitest";

import {
  completedSectionCount,
  questionIndexInSection,
  sectionIndexForQuestion,
  sectionStartIndexes,
} from "./sections";

describe("section boundary helpers", () => {
  it("computes start indexes", () => {
    expect(sectionStartIndexes([10, 10, 10, 10])).toEqual([0, 10, 20, 30]);
    expect(sectionStartIndexes([3, 7, 2])).toEqual([0, 3, 10]);
    expect(sectionStartIndexes([])).toEqual([]);
  });

  it("maps flat index to section index", () => {
    expect(sectionIndexForQuestion([10, 10, 10, 10], 0)).toBe(0);
    expect(sectionIndexForQuestion([10, 10, 10, 10], 9)).toBe(0);
    expect(sectionIndexForQuestion([10, 10, 10, 10], 10)).toBe(1);
    expect(sectionIndexForQuestion([10, 10, 10, 10], 39)).toBe(3);
    expect(sectionIndexForQuestion([3, 7, 2], 3)).toBe(1);
    expect(sectionIndexForQuestion([3, 7, 2], 11)).toBe(2); // clamps past the end
  });

  it("maps flat index to index within its section", () => {
    expect(questionIndexInSection([10, 10, 10, 10], 0)).toBe(0);
    expect(questionIndexInSection([10, 10, 10, 10], 15)).toBe(5);
    expect(questionIndexInSection([3, 7, 2], 9)).toBe(6);
  });

  it("counts fully completed sections", () => {
    expect(completedSectionCount([10, 10, 10, 10], 0, false)).toBe(0);
    expect(completedSectionCount([10, 10, 10, 10], 9, false)).toBe(0);
    expect(completedSectionCount([10, 10, 10, 10], 10, false)).toBe(1);
    expect(completedSectionCount([10, 10, 10, 10], 39, false)).toBe(3);
    expect(completedSectionCount([10, 10, 10, 10], 39, true)).toBe(4);
    expect(completedSectionCount([5, 5], 5, false)).toBe(1);
  });
});
