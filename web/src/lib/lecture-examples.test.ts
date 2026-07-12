import { describe, expect, it } from "vitest";
import { parseLectureExamples, splitLectureSegments } from "./lecture-examples";

const MD = [
  "# Title",
  "",
  "Intro paragraph.",
  "",
  "```example",
  "id: sp-1",
  "prompt: She ___ (go) to school every day.",
  "hint: Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
  "answer: goes",
  "```",
  "",
  "---",
  "",
  "More text.",
  "",
  "```example",
  "id: sp-2",
  "prompt: They ___ (not / like) coffee.",
  "hint: Phủ định với chủ ngữ số nhiều.",
  "answer: don't like / do not like",
  "```",
  "",
].join("\n");

describe("parseLectureExamples", () => {
  it("extracts full examples with /-separated variants", () => {
    const examples = parseLectureExamples(MD);
    expect(examples).toHaveLength(2);
    expect(examples[0]).toEqual({
      id: "sp-1",
      prompt: "She ___ (go) to school every day.",
      hint: "Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
      answer: "goes",
      variants: ["goes"],
    });
    expect(examples[1].variants).toEqual(["don't like", "do not like"]);
  });

  it("skips malformed blocks (missing required key)", () => {
    const bad = "```example\nid: x\nprompt: a ___ b\n```\n";
    expect(parseLectureExamples(bad)).toEqual([]);
  });

  it("skips duplicate ids after the first", () => {
    const dup = MD.replace("id: sp-2", "id: sp-1");
    expect(parseLectureExamples(dup)).toHaveLength(1);
  });

  it("strips frontmatter before scanning", () => {
    const withFm = `---\nid: "x"\n---\n${MD}`;
    expect(parseLectureExamples(withFm)).toHaveLength(2);
  });
});

describe("splitLectureSegments", () => {
  it("alternates markdown chunks and safe examples, never leaks answers", () => {
    const segs = splitLectureSegments(MD);
    expect(segs.map((s) => s.type)).toEqual([
      "markdown",
      "example",
      "markdown",
      "example",
    ]);
    const ex = segs[1] as { type: "example"; example: { id: string } };
    expect(ex.example).toEqual({
      id: "sp-1",
      prompt: "She ___ (go) to school every day.",
      hint: "Chủ ngữ ngôi thứ 3 số ít → thêm -es.",
    });
    expect(JSON.stringify(segs)).not.toContain("goes");
    expect(JSON.stringify(segs)).not.toContain("answer");
  });

  it("leaves a malformed example fence in the markdown chunk", () => {
    const bad = "Text.\n\n```example\nid: x\n```\n\nAfter.";
    const segs = splitLectureSegments(bad);
    expect(segs).toHaveLength(1);
    expect((segs[0] as { content: string }).content).toContain("```example");
  });

  it("returns one markdown segment for a lecture without examples", () => {
    expect(splitLectureSegments("# Hi\n\nBody.")).toEqual([
      { type: "markdown", content: "# Hi\n\nBody." },
    ]);
  });
});
