import { describe, expect, it } from "vitest";
import { stripFrontmatter } from "./strip-frontmatter";

describe("stripFrontmatter", () => {
  it("removes a leading YAML frontmatter block", () => {
    const md = `---\nid: "phase_1/lesson_01/lecture"\ntype: lecture\n---\n\n# BÀI 1\n`;
    expect(stripFrontmatter(md)).toBe(`\n# BÀI 1\n`);
  });
  it("returns content without frontmatter unchanged", () => {
    expect(stripFrontmatter("# Heading\nbody")).toBe("# Heading\nbody");
  });
  it("does not touch a --- thematic break later in the document", () => {
    const md = "# Heading\n\n---\n\nbody";
    expect(stripFrontmatter(md)).toBe(md);
  });
  it("handles empty string", () => {
    expect(stripFrontmatter("")).toBe("");
  });
});
