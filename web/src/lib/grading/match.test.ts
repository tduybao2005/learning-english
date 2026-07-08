import { describe, it, expect } from "vitest";
import { matchAnswer, type MatchQuestion, type QuestionKind } from "./match";
import { normalize } from "./normalize";

function variants(...texts: string[]) {
  return texts.map((text) => ({ normalized: text }));
}

describe("matchAnswer", () => {
  it("returns EXACT when the normalized input equals a variant", () => {
    const result = matchAnswer("She goes to school", {
      kind: "FILL_BLANK",
      isOpenEnded: false,
      variants: variants("she goes to school"),
    });
    expect(result).toEqual({ correct: true, matchType: "EXACT" });
  });

  it("returns EXACT for FILL_BLANK when casing/punctuation differ but text is the same", () => {
    const result = matchAnswer("Cooks.", {
      kind: "FILL_BLANK",
      isOpenEnded: false,
      variants: variants("cooks"),
    });
    expect(result).toEqual({ correct: true, matchType: "EXACT" });
  });

  describe("contraction equivalence -> VARIANT", () => {
    const cases: [string, string][] = [
      ["is not", "isn't"],
      ["isn't", "is not"],
      ["does not", "doesn't"],
      ["doesn't", "does not"],
      ["do not", "don't"],
      ["don't", "do not"],
      ["are not", "aren't"],
      ["aren't", "are not"],
      ["cannot", "can't"],
      ["can't", "cannot"],
    ];

    for (const [input, keyForm] of cases) {
      it(`matches "${input}" against key stored as "${keyForm}"`, () => {
        const result = matchAnswer(input, {
          kind: "FILL_BLANK",
          isOpenEnded: false,
          variants: variants(keyForm),
        });
        expect(result).toEqual({ correct: true, matchType: "VARIANT" });
      });
    }

    it("matches a contraction embedded in a full sentence", () => {
      const result = matchAnswer("She is not happy", {
        kind: "TRANSFORMATION",
        isOpenEnded: false,
        variants: variants("she isn't happy"),
      });
      expect(result).toEqual({ correct: true, matchType: "VARIANT" });
    });
  });

  describe("fuzzy matching for sentence kinds", () => {
    it("returns FUZZY for TRANSFORMATION when similarity is >= 0.85", () => {
      // key (already normalized, no trailing punctuation): "when do they play football" (26 chars)
      // input normalizes to "when do they play footbal" (25 chars); edit distance to key is 1
      // (missing final 'l' in "footbal" vs "football") -> similarity = 1 - 1/26 ≈ 0.9615 >= 0.85
      const result = matchAnswer("When do they play footbal?", {
        kind: "TRANSFORMATION",
        isOpenEnded: false,
        variants: variants("when do they play football"),
      });
      expect(result).toEqual({ correct: true, matchType: "FUZZY" });
    });

    it("returns incorrect for TRANSFORMATION when similarity is well below 0.85", () => {
      const result = matchAnswer("They never play anything at all", {
        kind: "TRANSFORMATION",
        isOpenEnded: false,
        variants: variants("when do they play football"),
      });
      expect(result).toEqual({ correct: false });
    });

    it("returns FUZZY for TRANSLATION on a near-miss typo", () => {
      // "todya" vs "today" is a transposition -> Levenshtein distance 2 (two substitutions,
      // since plain Levenshtein has no transposition operation). Full strings are 26 chars
      // each -> similarity = 1 - 2/26 ≈ 0.9231 >= 0.85.
      const result = matchAnswer("I am going to school todya", {
        kind: "TRANSLATION",
        isOpenEnded: false,
        variants: variants("i am going to school today"),
      });
      expect(result).toEqual({ correct: true, matchType: "FUZZY" });
    });

    it("returns FUZZY for ERROR_CORRECTION on a near-miss", () => {
      const result = matchAnswer("She doesn't likes apples", {
        kind: "ERROR_CORRECTION",
        isOpenEnded: false,
        variants: variants("she doesn't like apples"),
      });
      expect(result).toEqual({ correct: true, matchType: "FUZZY" });
    });
  });

  describe("fuzzy gate excludes non-sentence kinds", () => {
    it("does NOT fuzzy-match FILL_BLANK near-miss (cook vs cooks)", () => {
      const result = matchAnswer("cook", {
        kind: "FILL_BLANK",
        isOpenEnded: false,
        variants: variants("cooks"),
      });
      expect(result).toEqual({ correct: false });
    });

    it("does NOT fuzzy-match MULTIPLE_CHOICE near-miss", () => {
      const result = matchAnswer("B", {
        kind: "MULTIPLE_CHOICE",
        isOpenEnded: false,
        variants: variants("A"),
      });
      expect(result).toEqual({ correct: false });
    });
  });

  describe("open-ended manual review", () => {
    it("returns MANUAL when isOpenEnded and input has >= 15 non-trivial chars", () => {
      const result = matchAnswer("This is my honest opinion about the topic.", {
        kind: "OPEN_WRITING",
        isOpenEnded: true,
        variants: [],
      });
      expect(result).toEqual({ correct: true, matchType: "MANUAL" });
    });

    it("does not return MANUAL when isOpenEnded but input is shorter than 15 chars", () => {
      const result = matchAnswer("too short", {
        kind: "OPEN_WRITING",
        isOpenEnded: true,
        variants: [],
      });
      expect(result).toEqual({ correct: false });
    });

    it("prefers EXACT over MANUAL when an open-ended answer also matches a variant exactly", () => {
      const result = matchAnswer("I love learning English every day", {
        kind: "OPEN_WRITING",
        isOpenEnded: true,
        variants: variants("i love learning english every day"),
      });
      expect(result).toEqual({ correct: true, matchType: "EXACT" });
    });
  });

  describe("empty / whitespace input", () => {
    it("returns incorrect for an empty string", () => {
      const result = matchAnswer("", {
        kind: "FILL_BLANK",
        isOpenEnded: false,
        variants: variants("anything"),
      });
      expect(result).toEqual({ correct: false });
    });

    it("returns incorrect for whitespace-only input", () => {
      const result = matchAnswer("   ", {
        kind: "OPEN_WRITING",
        isOpenEnded: true,
        variants: [],
      });
      expect(result).toEqual({ correct: false });
    });

    it("returns incorrect for whitespace-only input even with matching variant", () => {
      const result = matchAnswer("  \t ", {
        kind: "FILL_BLANK",
        isOpenEnded: false,
        variants: variants(""),
      });
      expect(result).toEqual({ correct: false });
    });
  });

  describe("no variants and not open-ended", () => {
    it("returns incorrect when there are no variants to match against", () => {
      const result = matchAnswer("hello", {
        kind: "FILL_BLANK",
        isOpenEnded: false,
        variants: [],
      });
      expect(result).toEqual({ correct: false });
    });
  });
});

const ecQuestion = (variants: string[]): MatchQuestion => ({
  kind: "ERROR_CORRECTION",
  isOpenEnded: false,
  variants: variants.map((v) => ({ normalized: normalize(v) })),
});

describe("ERROR_CORRECTION whole-sentence answers", () => {
  const q = ecQuestion(["doesn't like"]);
  it("accepts the full corrected sentence containing the fix", () => {
    expect(matchAnswer("She doesn't like vegetables. She prefers fruit.", q).correct).toBe(true);
  });
  it("accepts the expanded contraction inside the sentence", () => {
    expect(matchAnswer("She does not like vegetables.", q).correct).toBe(true);
  });
  it("still accepts the bare corrected phrase", () => {
    expect(matchAnswer("doesn't like", q).correct).toBe(true);
  });
  it("rejects the original uncorrected sentence", () => {
    expect(matchAnswer("She don't like vegetables. She prefer fruit.", q).correct).toBe(false);
  });
  it("does not match a variant inside a longer word", () => {
    expect(matchAnswer("she prefersx", ecQuestion(["prefers"])).correct).toBe(false);
  });
});

describe("QuestionKind type", () => {
  it("accepts all six kinds (compile-time check via runtime usage)", () => {
    const kinds: QuestionKind[] = [
      "FILL_BLANK",
      "MULTIPLE_CHOICE",
      "TRANSFORMATION",
      "ERROR_CORRECTION",
      "TRANSLATION",
      "OPEN_WRITING",
    ];
    expect(kinds).toHaveLength(6);
  });
});
