import path from "path";
import { describe, expect, it } from "vitest";

import { parseListening } from "./parse-listening";
import {
  checkCorpus,
  checkListeningSet,
  estimateAudioSeconds,
  totalPauseSeconds,
  transcriptSimilarity,
  type ListeningSetInput,
} from "./check-listening";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");
const DEFAULT_LINE = "the library desk is open every weekday morning for students";

interface FixtureOpts {
  slug?: string;
  title?: string;
  level?: string | null;
  sections?: number;
  questionsPerSection?: number;
  dropKey?: boolean;
  dropMarkers?: boolean;
  extraSpeaker?: boolean;
  pauseSeconds?: number;
  lineWords?: string;
}

function makeSetMd({
  slug = "practice_b1_99",
  title = "Practice Listening: Fixture Set",
  level = "B1",
  sections = 4,
  questionsPerSection = 10,
  dropKey = false,
  dropMarkers = false,
  extraSpeaker = false,
  pauseSeconds = 45,
  lineWords = DEFAULT_LINE,
}: FixtureOpts = {}): string {
  const kinds = ["FILL", "MCQ", "MCQ", "FILL"];
  let qNum = 0;
  const transcript: string[] = [];
  const questionBlocks: string[] = [];
  const keyBlocks: string[] = [];
  for (let s = 0; s < sections; s++) {
    if (!dropMarkers) transcript.push(`NARRATOR: Section ${s + 1}. Now look at the questions.`);
    transcript.push(`[PAUSE:${pauseSeconds}]`);
    for (let i = 0; i < 30; i++) {
      transcript.push(`${s % 2 === 0 ? "A" : "B"}: ${lineWords} item ${s} ${i}.`);
    }
    if (extraSpeaker && s === 0) transcript.push("Z: An unmapped speaker line.");
    const kind = kinds[s % 4];
    const header =
      kind === "FILL" ? "FILL IN THE BLANK (Điền vào chỗ trống)" : "MULTIPLE CHOICE (Trắc nghiệm)";
    const qLines: string[] = [`## SECTION ${s + 1}: ${header}`];
    const kLines: string[] = [`### Section ${s + 1}:`];
    for (let q = 0; q < questionsPerSection; q++) {
      qNum++;
      if (kind === "FILL") {
        qLines.push(`${qNum}. The answer to item ${qNum} is ______ .`);
        kLines.push(`${qNum}. answer${qNum}`);
      } else {
        qLines.push(`${qNum}. What is item ${qNum}?`, "- A) First", "- B) Second", "- C) Third", "- D) Fourth");
        kLines.push(`${qNum}. B (Second)`);
      }
    }
    questionBlocks.push(qLines.join("\n"));
    keyBlocks.push(kLines.join("\n"));
  }
  return [
    "---",
    `slug: ${slug}`,
    `title: "${title}"`,
    "kind: PRACTICE",
    ...(level ? [`level: ${level}`] : []),
    "voices: { A: en-US-GuyNeural, B: en-GB-SoniaNeural, NARRATOR: en-US-JennyNeural }",
    "---",
    "## TRANSCRIPT",
    ...transcript,
    "## QUESTIONS",
    ...questionBlocks,
    ...(dropKey ? [] : ["## ANSWER KEY (ĐÁP ÁN)", ...keyBlocks]),
    "",
  ].join("\n");
}

function makeInput(overrides: FixtureOpts = {}): ListeningSetInput {
  const raw = makeSetMd(overrides);
  const slug = overrides.slug ?? "practice_b1_99";
  return { file: `/content/listening/${slug}.md`, raw, parsed: parseListening(raw) };
}

const errors = (issues: ReturnType<typeof checkListeningSet>) =>
  issues.filter((i) => i.severity === "ERROR");

describe("checkListeningSet", () => {
  it("passes a well-formed 4×10 practice set with no ERRORs", () => {
    expect(errors(checkListeningSet(makeInput(), PUBLIC_DIR))).toEqual([]);
  });

  it("flags wrong section count", () => {
    const issues = checkListeningSet(makeInput({ sections: 3 }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /expected 4 sections/.test(i.message))).toBe(true);
  });

  it("flags wrong total question count", () => {
    const issues = checkListeningSet(makeInput({ questionsPerSection: 9 }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /expected 40 questions/.test(i.message))).toBe(true);
  });

  it("flags missing level on PRACTICE sets", () => {
    const issues = checkListeningSet(makeInput({ level: null }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /missing front-matter 'level'/.test(i.message))).toBe(true);
  });

  it("flags a missing answer key", () => {
    const issues = checkListeningSet(makeInput({ dropKey: true }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /no ANSWER KEY/.test(i.message))).toBe(true);
  });

  it("flags transcript speakers without a voices mapping", () => {
    const issues = checkListeningSet(makeInput({ extraSpeaker: true }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /speaker 'Z'/.test(i.message))).toBe(true);
  });

  it("flags missing NARRATOR section markers", () => {
    const issues = checkListeningSet(makeInput({ dropMarkers: true }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "ERROR" && /NARRATOR: Section N/.test(i.message))).toBe(true);
  });

  it("warns on an oversized single pause", () => {
    const issues = checkListeningSet(makeInput({ pauseSeconds: 900 }), PUBLIC_DIR);
    expect(issues.some((i) => i.severity === "WARN" && /longer than 60s/.test(i.message))).toBe(true);
  });
});

describe("checkCorpus", () => {
  it("flags duplicate titles", () => {
    const a = makeInput({ slug: "practice_b1_98" });
    const b = makeInput({ slug: "practice_b1_97" });
    expect(checkCorpus([a, b]).some((i) => i.severity === "ERROR" && /duplicate title/.test(i.message))).toBe(true);
  });

  it("warns on near-identical transcripts, passes distinct ones", () => {
    const a = makeInput({ slug: "practice_b1_98", title: "Practice Listening: Fixture A" });
    const b = makeInput({ slug: "practice_b1_97", title: "Practice Listening: Fixture B" });
    expect(checkCorpus([a, b]).some((i) => /possible duplicate content/.test(i.message))).toBe(true);

    const c = makeInput({
      slug: "practice_b2_01",
      title: "Practice Listening: Fixture C",
      lineWords: "our ferry departs from harbour gate nine at dawn with crew",
    });
    expect(checkCorpus([a, c]).some((i) => /possible duplicate content/.test(i.message))).toBe(false);
  });
});

describe("pause and duration estimation", () => {
  it("sums [PAUSE:n] lines", () => {
    expect(totalPauseSeconds("A: hi\n[PAUSE:20]\nB: yo\n[PAUSE:15.5]\n")).toBeCloseTo(35.5);
  });

  it("similarity is ~1 for identical and ~0 for disjoint text", () => {
    const t = "A: one two three four five six seven eight nine ten";
    expect(transcriptSimilarity(t, t)).toBeCloseTo(1);
    expect(transcriptSimilarity(t, "B: alpha beta gamma delta epsilon zeta eta theta")).toBe(0);
  });

  it("estimate includes speech, pauses and turn gaps", () => {
    const input = makeInput();
    expect(estimateAudioSeconds(input.parsed, input.raw)).toBeGreaterThan(totalPauseSeconds(input.raw));
  });
});
