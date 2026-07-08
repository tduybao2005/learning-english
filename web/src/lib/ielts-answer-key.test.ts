import { describe, expect, it } from "vitest";
import { sliceAnswerKeyBySkill } from "./ielts-answer-key";

const KEY = `# ANSWER KEY — TEST 01

## READING

1. B
2. C

## WRITING

Task 1 model answer...

## SPEAKING

Part 1 sample...
`;

describe("sliceAnswerKeyBySkill", () => {
  it("returns only the READING section", () => {
    const out = sliceAnswerKeyBySkill(KEY, "reading");
    expect(out).toContain("1. B");
    expect(out).not.toContain("model answer");
  });
  it("returns only the SPEAKING section (last section, runs to EOF)", () => {
    const out = sliceAnswerKeyBySkill(KEY, "speaking");
    expect(out).toContain("Part 1 sample");
    expect(out).not.toContain("1. B");
  });
  it("falls back to the full key when no skill heading exists", () => {
    const md = "# Key\n1. A\n2. B\n";
    expect(sliceAnswerKeyBySkill(md, "writing")).toBe(md);
  });
  it("includes multiple consecutive same-depth headings belonging to the same skill", () => {
    const md = `## WRITING
> pointer line
## Checklist Tự Đánh Giá Writing
- item one
## SPEAKING
Part 1 sample
`;
    const out = sliceAnswerKeyBySkill(md, "writing");
    expect(out).toContain("pointer line");
    expect(out).toContain("item one");
    expect(out).toContain("Checklist");
    expect(out).not.toContain("Part 1 sample");
  });
});
