import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseIeltsReading, ParsedIeltsReading } from "./parse-ielts-reading";

const repoRoot = path.resolve(process.cwd(), "..");

function parseTest(nn: string): ParsedIeltsReading {
  const dir = path.join(repoRoot, "ielts_practice_tests", `test_${nn}`);
  return parseIeltsReading(
    fs.readFileSync(path.join(dir, "reading.md"), "utf8"),
    fs.readFileSync(path.join(dir, "answer_key.md"), "utf8")
  );
}

/**
 * The gate: `scripts/check_ielts_keys.py` (repo root) cross-checked every
 * answer_key.md against its own reading.md. 19 of 30 tests agree structurally;
 * the other 11 have keys answering questions the paper never asks. These two
 * lists are the same ones the plan and the seed use — keep them in sync.
 */
const USABLE = [
  "02", "03", "04", "07", "08", "12", "13", "14", "18",
  "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
];
const BROKEN = ["01", "05", "06", "09", "10", "11", "15", "16", "17", "19", "30"];

describe("parseIeltsReading — the 19 known-good tests", () => {
  for (const nn of USABLE) {
    it(`test_${nn} parses to exactly 40 usable questions`, () => {
      const parsed = parseTest(nn);
      expect(parsed.problems).toEqual([]);
      expect(parsed.usable).toBe(true);
      expect(parsed.questions).toHaveLength(40);
      expect(parsed.questions.map((q) => q.number)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 1)
      );
      for (const q of parsed.questions) {
        expect(["MULTIPLE_CHOICE", "FILL_BLANK"]).toContain(q.kind);
        expect(q.answerRaw.trim()).not.toBe("");
        expect(q.variants.length).toBeGreaterThan(0);
        expect(q.prompt.trim()).not.toBe("");
        if (q.kind === "MULTIPLE_CHOICE") {
          expect(q.options && q.options.length).toBeGreaterThan(1);
          // the stored answer must be one of the offered options
          expect(q.options!.map((o) => o.label)).toContain(q.variants[0].text);
        } else {
          expect(q.options).toBeNull();
        }
      }
    });
  }
});

describe("parseIeltsReading — the 11 known-broken tests", () => {
  for (const nn of BROKEN) {
    it(`test_${nn} is reported unusable, not silently mangled`, () => {
      const parsed = parseTest(nn);
      expect(parsed.usable).toBe(false);
      expect(parsed.problems.length).toBeGreaterThan(0);
    });
  }
});

// --------------------------------------------------------------------------
// The four format traps, each pinned to the test that exhibits it.
// --------------------------------------------------------------------------

describe("trap 1a — English key table (test_07)", () => {
  const parsed = parseTest("07");

  it("reads the Answer column of `| Q | Answer | Explanation |`", () => {
    const q1 = parsed.questions[0];
    expect(q1.kind).toBe("MULTIPLE_CHOICE");
    expect(q1.variants[0].text).toBe("FALSE");
    expect(q1.options!.map((o) => o.label)).toEqual(["TRUE", "FALSE", "NOT GIVEN"]);
    expect(q1.explanation).toContain("8.7 million species");
  });

  it("matching-headings answers come from column 3, not the paragraph column", () => {
    const q6 = parsed.questions.find((q) => q.number === 6)!;
    // `| 6 | B | **vii** — ... |` — "B" is the paragraph, "vii" is the answer
    expect(q6.variants[0].text).toBe("vii");
    expect(q6.options!.map((o) => o.label)).toContain("vii");
  });

  it("short-answer questions are FILL_BLANK with no options", () => {
    const q10 = parsed.questions.find((q) => q.number === 10)!;
    expect(q10.kind).toBe("FILL_BLANK");
    expect(q10.options).toBeNull();
    expect(q10.variants[0].text).toBe("regulating services");
  });

  it("splits `/` variants — all of them are correct", () => {
    const q12 = parsed.questions.find((q) => q.number === 12)!;
    // key: `**their behaviour** / **behaviour**`
    expect(q12.variants.map((v) => v.text)).toEqual(["their behaviour", "behaviour"]);
    expect(q12.variants[1].normalized).toBe("behaviour");
  });
});

describe("trap 1b — Vietnamese key table (test_02)", () => {
  const parsed = parseTest("02");

  it("reads `Đáp án`, not `Câu`/`Đoạn`", () => {
    const q1 = parsed.questions[0];
    expect(q1.variants[0].text).toBe("TRUE");
    expect(q1.explanation).toBeTruthy();
  });

  it("parses a List of Headings written as a markdown table", () => {
    const q6 = parsed.questions.find((q) => q.number === 6)!;
    expect(q6.options!.map((o) => o.label)).toEqual([
      "i", "ii", "iii", "iv", "v", "vi", "vii", "viii",
    ]);
  });
});

describe("trap 2 — bold question numbers (test_26)", () => {
  it("`| **1** | **FALSE** |` is read as question 1", () => {
    const parsed = parseTest("26");
    expect(parsed.questions[0].variants[0].text).toBe("FALSE");
    expect(parsed.questions.find((q) => q.number === 7)!.variants[0].text).toBe(
      "seafloor spreading"
    );
  });
});

describe("trap 3 — key as a numbered list (test_05)", () => {
  it("`1. TRUE` is read even though the test is otherwise broken", () => {
    const parsed = parseTest("05");
    const q1 = parsed.questions.find((q) => q.number === 1);
    expect(q1?.answerRaw).toBe("TRUE");
    expect(parsed.usable).toBe(false);
  });
});

describe("trap 4 — `**Questions n–m:**` group markers (test_29)", () => {
  const parsed = parseTest("29");

  it("picks up bold (non-heading) group markers", () => {
    expect(parsed.questions).toHaveLength(40);
  });

  it("assigns the kind from the innermost group, not the `**Questions 1–13**` umbrella", () => {
    expect(parsed.questions.find((q) => q.number === 1)!.options!.map((o) => o.label)).toEqual([
      "TRUE", "FALSE", "NOT GIVEN",
    ]);
    expect(parsed.questions.find((q) => q.number === 7)!.kind).toBe("FILL_BLANK");
    // Q14–18: "Which paragraph contains the following information? A–G"
    expect(
      parsed.questions.find((q) => q.number === 14)!.options!.map((o) => o.label)
    ).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    // Q24–26: MCQ A–D
    expect(
      parsed.questions.find((q) => q.number === 24)!.options!.map((o) => o.label)
    ).toEqual(["A", "B", "C", "D"]);
  });
});

describe("the raw-score → band table is not mistaken for answers", () => {
  it("test_07 has no question numbered above 40", () => {
    const parsed = parseTest("07");
    expect(parsed.questions.every((q) => q.number <= 40)).toBe(true);
  });
});
