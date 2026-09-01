import { describe, it, expect } from "vitest";

import {
  eligibleForGames,
  sampleDistractors,
  buildQuizRounds,
  buildMatchRounds,
  resultTier,
  resolveSwipe,
  type VocabWordLite,
} from "./games";

// Deterministic RNG: cycles through a fixed sequence of [0,1) values so
// shuffle/sampling behavior is reproducible in tests instead of relying on
// real Math.random().
function seededRng(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const v = sequence[i % sequence.length];
    i += 1;
    return v;
  };
}

function makeWord(id: string, meaningVi = `nghĩa ${id}`): VocabWordLite {
  return { id, word: `word-${id}`, meaningVi, audioUrl: null };
}

describe("eligibleForGames", () => {
  it("excludes words with an empty meaningVi", () => {
    const words = [makeWord("w1"), makeWord("w2", ""), makeWord("w3")];
    const eligible = eligibleForGames(words);
    expect(eligible.map((w) => w.id)).toEqual(["w1", "w3"]);
  });
});

describe("sampleDistractors", () => {
  const pool = [
    makeWord("w1"),
    makeWord("w2"),
    makeWord("w3"),
    makeWord("w4"),
    makeWord("w5", ""), // empty meaning — must never be sampled
  ];

  it("returns the requested count of distractors, excluding the correct word", () => {
    const correct = pool[0];
    const distractors = sampleDistractors(pool, correct, 3, seededRng([0.1, 0.5, 0.9, 0.2]));
    expect(distractors).toHaveLength(3);
    expect(distractors.some((d) => d.id === correct.id)).toBe(false);
  });

  it("never includes duplicates", () => {
    const correct = pool[0];
    const distractors = sampleDistractors(pool, correct, 3, seededRng([0.1, 0.5, 0.9, 0.2]));
    const ids = distractors.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never samples a word with an empty meaningVi", () => {
    const correct = pool[0];
    const distractors = sampleDistractors(pool, correct, 10, seededRng([0.1, 0.5, 0.9, 0.2]));
    expect(distractors.some((d) => d.meaningVi === "")).toBe(false);
  });

  it("returns fewer than requested when the pool is smaller than count (no crash)", () => {
    const smallPool = [makeWord("a"), makeWord("b")];
    const distractors = sampleDistractors(smallPool, smallPool[0], 3, seededRng([0.1]));
    expect(distractors).toHaveLength(1);
    expect(distractors[0].id).toBe("b");
  });
});

describe("buildQuizRounds", () => {
  const words: VocabWordLite[] = Array.from({ length: 12 }, (_, i) => makeWord(`w${i}`));
  // Add a word with empty meaning that must never appear as a question or distractor.
  words.push(makeWord("blank", ""));

  it("yields 10 rounds when there are enough eligible words", () => {
    const rounds = buildQuizRounds(words, 10, 4, seededRng([0.3, 0.6, 0.9, 0.1, 0.4]));
    expect(rounds).toHaveLength(10);
  });

  it("never repeats the same wordId across rounds in one session", () => {
    const rounds = buildQuizRounds(words, 10, 4, seededRng([0.3, 0.6, 0.9, 0.1, 0.4]));
    const ids = rounds.map((r) => r.wordId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each round has exactly 4 options including the correct one, no duplicates", () => {
    const rounds = buildQuizRounds(words, 10, 4, seededRng([0.3, 0.6, 0.9, 0.1, 0.4]));
    for (const round of rounds) {
      expect(round.options).toHaveLength(4);
      const optionIds = round.options.map((o) => o.id);
      expect(new Set(optionIds).size).toBe(4);
      expect(optionIds).toContain(round.correctOptionId);
      expect(round.correctOptionId).toBe(round.wordId);
    }
  });

  it("never uses the empty-meaning word as a question or a distractor", () => {
    const rounds = buildQuizRounds(words, 10, 4, seededRng([0.3, 0.6, 0.9, 0.1, 0.4]));
    for (const round of rounds) {
      expect(round.wordId).not.toBe("blank");
      expect(round.options.map((o) => o.id)).not.toContain("blank");
    }
  });

  it("reduces option count gracefully when the lesson has too few eligible words", () => {
    const tinyLesson = [makeWord("a"), makeWord("b"), makeWord("c")];
    const rounds = buildQuizRounds(tinyLesson, 10, 4, seededRng([0.2, 0.5, 0.8]));
    expect(rounds).toHaveLength(3);
    for (const round of rounds) {
      expect(round.options.length).toBeLessThanOrEqual(3);
      expect(round.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns an empty array when there are no eligible words (zero-word or all-blank lesson)", () => {
    expect(buildQuizRounds([], 10, 4)).toEqual([]);
    expect(buildQuizRounds([makeWord("only", "")], 10, 4)).toEqual([]);
  });

  it("returns an empty array when only one eligible word exists (no possible distractor)", () => {
    expect(buildQuizRounds([makeWord("solo")], 10, 4)).toEqual([]);
  });
});

describe("buildMatchRounds", () => {
  it("yields 6 shuffled pairs per round when there are enough words", () => {
    const words = Array.from({ length: 6 }, (_, i) => makeWord(`w${i}`));
    const rounds = buildMatchRounds(words, 6, seededRng([0.4, 0.7, 0.2, 0.9, 0.1]));
    expect(rounds).toHaveLength(1);
    expect(rounds[0].pairs).toHaveLength(6);
    expect(rounds[0].left).toHaveLength(6);
    expect(rounds[0].right).toHaveLength(6);
  });

  it("chunks a larger word list into multiple rounds with no repeated wordId across the whole session", () => {
    const words = Array.from({ length: 13 }, (_, i) => makeWord(`w${i}`));
    const rounds = buildMatchRounds(words, 6, seededRng([0.4, 0.7, 0.2, 0.9, 0.1, 0.05, 0.55]));
    const allIds = rounds.flatMap((r) => r.pairs.map((p) => p.wordId));
    expect(new Set(allIds).size).toBe(allIds.length);
    // 13 words / 6 per round = 2 full rounds of 6; the trailing single word
    // is dropped (not enough to form a meaningful match round on its own).
    expect(rounds).toHaveLength(2);
    expect(allIds).toHaveLength(12);
  });

  it("excludes words with an empty meaningVi from every round", () => {
    const words = [...Array.from({ length: 6 }, (_, i) => makeWord(`w${i}`)), makeWord("blank", "")];
    const rounds = buildMatchRounds(words, 6, seededRng([0.4, 0.7, 0.2, 0.9, 0.1]));
    const allIds = rounds.flatMap((r) => r.pairs.map((p) => p.wordId));
    expect(allIds).not.toContain("blank");
  });

  it("left and right columns are shuffled permutations of the same pairs (not necessarily in canonical order)", () => {
    const words = Array.from({ length: 6 }, (_, i) => makeWord(`w${i}`));
    const rounds = buildMatchRounds(words, 6, seededRng([0.4, 0.7, 0.2, 0.9, 0.1, 0.05]));
    const round = rounds[0];
    expect(round.left.map((p) => p.wordId).sort()).toEqual(round.pairs.map((p) => p.wordId).sort());
    expect(round.right.map((p) => p.wordId).sort()).toEqual(round.pairs.map((p) => p.wordId).sort());
  });

  it("reduces pair count gracefully for a lesson with fewer than 6 eligible words", () => {
    const words = [makeWord("a"), makeWord("b"), makeWord("c")];
    const rounds = buildMatchRounds(words, 6, seededRng([0.3, 0.6]));
    expect(rounds).toHaveLength(1);
    expect(rounds[0].pairs).toHaveLength(3);
  });

  it("returns an empty array for a lesson with zero or only one eligible word", () => {
    expect(buildMatchRounds([], 6)).toEqual([]);
    expect(buildMatchRounds([makeWord("only")], 6)).toEqual([]);
    expect(buildMatchRounds([makeWord("only", "")], 6)).toEqual([]);
  });
});

describe("resultTier", () => {
  it("gives the top tier only from 90% up", () => {
    expect(resultTier(10, 10)).toBe("excellent");
    expect(resultTier(9, 10)).toBe("excellent");
    expect(resultTier(8, 10)).toBe("good");
  });

  it("gives the middle tier from 70% up", () => {
    expect(resultTier(7, 10)).toBe("good");
    expect(resultTier(69, 100)).toBe("review");
  });

  it("gives the bottom tier below 70%", () => {
    expect(resultTier(0, 10)).toBe("review");
    expect(resultTier(1, 3)).toBe("review");
  });

  it("never divides by zero on an empty session", () => {
    expect(resultTier(0, 0)).toBe("review");
  });
});

describe("resolveSwipe", () => {
  it("treats a rightward drag past the threshold as 'đã nhớ'", () => {
    expect(resolveSwipe(120, 100)).toBe("know");
    expect(resolveSwipe(100, 100)).toBe("know");
  });

  it("treats a leftward drag past the threshold as 'chưa nhớ'", () => {
    expect(resolveSwipe(-120, 100)).toBe("dont-know");
    expect(resolveSwipe(-100, 100)).toBe("dont-know");
  });

  it("ignores a drag that never reaches the threshold", () => {
    expect(resolveSwipe(99, 100)).toBe("none");
    expect(resolveSwipe(-99, 100)).toBe("none");
    expect(resolveSwipe(0, 100)).toBe("none");
  });
});
