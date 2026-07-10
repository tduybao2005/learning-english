import { describe, expect, it } from "vitest";

import { transcriptChunksForSections } from "./transcript";

const FOUR_SECTIONS = [
  "Welcome preamble line.",
  "NARRATOR: Section 1. You will hear a phone call. First, look at questions 1 to 10.",
  "A: Hello, this is section one speech.",
  "NARRATOR: That is the end of Section 1. Check your answers.",
  "NARRATOR: Section 2. You will hear a talk.",
  "C: Section two monologue.",
  "NARRATOR: Section 3. You will hear a discussion.",
  "D: Section three dialogue.",
  "NARRATOR: Section 4. You will hear a lecture.",
  "F: Section four lecture.",
].join("\n");

describe("transcriptChunksForSections", () => {
  it("splits into one chunk per section, preamble joins chunk 0", () => {
    const chunks = transcriptChunksForSections(FOUR_SECTIONS, 4);
    expect(chunks).toHaveLength(4);
    expect(chunks![0]).toContain("Welcome preamble line.");
    expect(chunks![0]).toContain("section one speech");
    expect(chunks![0]).toContain("end of Section 1"); // outro stays in its own chunk
    expect(chunks![1]).toContain("Section two monologue");
    expect(chunks![3]).toContain("Section four lecture");
  });

  it("returns null when marker count != sectionCount", () => {
    expect(transcriptChunksForSections(FOUR_SECTIONS, 2)).toBeNull();
  });

  it("returns null when there are no markers (e.g. TOEIC 'Part N')", () => {
    expect(transcriptChunksForSections("NARRATOR: Part 1. Photographs.\nA: text", 4)).toBeNull();
  });

  it("returns null when marker numbers are out of order", () => {
    const bad = FOUR_SECTIONS.replace("NARRATOR: Section 2.", "NARRATOR: Section 3.").replace(
      "NARRATOR: Section 3. You will hear a discussion.",
      "NARRATOR: Section 2. You will hear a discussion.",
    );
    expect(transcriptChunksForSections(bad, 4)).toBeNull();
  });

  it("returns null for sectionCount <= 0", () => {
    expect(transcriptChunksForSections(FOUR_SECTIONS, 0)).toBeNull();
  });
});
