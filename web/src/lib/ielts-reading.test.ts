import { describe, expect, it } from "vitest";
import { splitReadingSections } from "./ielts-reading";

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
