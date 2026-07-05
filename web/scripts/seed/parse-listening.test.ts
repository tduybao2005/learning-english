import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseListening } from "./parse-listening";

const repoRoot = path.resolve(process.cwd(), "..");
function fixture(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

const inlineFixture = `---
slug: practice_99
title: "Practice Listening: Sample"
kind: PRACTICE
voices: { A: en-US-GuyNeural, B: en-GB-SoniaNeural, NARRATOR: en-US-JennyNeural }
---
## TRANSCRIPT
NARRATOR: Section 1. Sample intro.
A: Hello, how can I help?
B: I'd like to book a class.
## QUESTIONS
## SECTION A: FILL IN THE BLANK (Điền vào chỗ trống)
1. The class starts on ______ .

## SECTION B: MULTIPLE CHOICE (Trắc nghiệm)
2. Which class did they book?
- A) Painting
- B) Photography
- C) Pottery
- D) Cooking

## ANSWER KEY (ĐÁP ÁN)
### Section A:
1. Monday / monday

### Section B:
2. B (Photography)
`;

describe("parseListening — front matter", () => {
  const parsed = parseListening(inlineFixture);

  it("extracts slug, title, kind", () => {
    expect(parsed.frontMatter.slug).toBe("practice_99");
    expect(parsed.frontMatter.title).toBe("Practice Listening: Sample");
    expect(parsed.frontMatter.kind).toBe("PRACTICE");
  });

  it("extracts the voices mapping", () => {
    expect(parsed.frontMatter.voices).toEqual({
      A: "en-US-GuyNeural",
      B: "en-GB-SoniaNeural",
      NARRATOR: "en-US-JennyNeural",
    });
  });
});

describe("parseListening — transcript extraction", () => {
  const parsed = parseListening(inlineFixture);

  it("extracts only the TRANSCRIPT block (not front matter or QUESTIONS)", () => {
    expect(parsed.transcriptMd).toContain("NARRATOR: Section 1. Sample intro.");
    expect(parsed.transcriptMd).toContain("A: Hello, how can I help?");
    expect(parsed.transcriptMd).toContain("B: I'd like to book a class.");
    expect(parsed.transcriptMd).not.toContain("## QUESTIONS");
    expect(parsed.transcriptMd).not.toContain("slug: practice_99");
    expect(parsed.transcriptMd).not.toContain("SECTION A");
  });
});

describe("parseListening — question parsing reuses parseExercise", () => {
  const parsed = parseListening(inlineFixture);

  it("parses SECTION A as FILL_BLANK with a matched variant", () => {
    const secA = parsed.questions.sections.find((s) => s.label === "A")!;
    expect(secA.kind).toBe("FILL_BLANK");
    const q1 = secA.questions.find((q) => q.number === 1)!;
    expect(q1.prompt).toContain("______");
    expect(q1.variants.map((v) => v.text)).toContain("Monday");
  });

  it("parses SECTION B as MULTIPLE_CHOICE with 4 options and variant 'B'", () => {
    const secB = parsed.questions.sections.find((s) => s.label === "B")!;
    expect(secB.kind).toBe("MULTIPLE_CHOICE");
    const q2 = secB.questions.find((q) => q.number === 2)!;
    expect(q2.options).toHaveLength(4);
    expect(q2.variants.map((v) => v.text)).toContain("B");
    expect(q2.keyNote).toBe("Photography");
  });
});

describe("parseListening — throws on malformed input", () => {
  it("throws when front matter is missing", () => {
    expect(() => parseListening("## TRANSCRIPT\nA: hi\n## QUESTIONS\n")).toThrow();
  });

  it("throws when TRANSCRIPT section is missing", () => {
    expect(() =>
      parseListening(`---\nslug: x\ntitle: "X"\nkind: PRACTICE\nvoices: { A: en-US-GuyNeural }\n---\n## QUESTIONS\n`)
    ).toThrow();
  });
});

describe("parseListening — against the real authored practice_01.md", () => {
  const parsed = parseListening(fixture("web/content/listening/practice_01.md"));

  it("has slug practice_01, kind PRACTICE, 3 voices", () => {
    expect(parsed.frontMatter.slug).toBe("practice_01");
    expect(parsed.frontMatter.kind).toBe("PRACTICE");
    expect(Object.keys(parsed.frontMatter.voices).sort()).toEqual(["A", "B", "NARRATOR"]);
  });

  it("has 5 FILL_BLANK questions in Section A and 5 MULTIPLE_CHOICE in Section B", () => {
    const secA = parsed.questions.sections.find((s) => s.label === "A")!;
    const secB = parsed.questions.sections.find((s) => s.label === "B")!;
    expect(secA.kind).toBe("FILL_BLANK");
    expect(secA.questions).toHaveLength(5);
    expect(secB.kind).toBe("MULTIPLE_CHOICE");
    expect(secB.questions).toHaveLength(5);
    for (const q of [...secA.questions, ...secB.questions]) {
      expect(q.variants.length).toBeGreaterThan(0);
    }
  });
});
