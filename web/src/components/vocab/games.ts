/**
 * Pure helpers for the vocab quiz + match games (Task 11). No React, no
 * fetch — deterministic given an injected `rng` (defaults to `Math.random`),
 * so tests can pass a seeded generator instead of relying on real randomness.
 *
 * Design note on the duplicate-`wordId` review-batch concern (see Task 10):
 * `applyReviewResults` doesn't chain Leitner transitions for the same
 * `wordId` appearing twice in one POST — it computes every result off a
 * pre-batch snapshot. Both `buildQuizRounds` and `buildMatchRounds` sidestep
 * this entirely by construction: they sample *without replacement* from the
 * lesson's eligible words, so no wordId can appear twice within one game
 * session's rounds. QuizGame/MatchGame therefore never need to dedupe
 * before POSTing to `/api/vocab/review`.
 */

export interface VocabWordLite {
  id: string;
  word: string;
  meaningVi: string;
}

/** Fisher-Yates shuffle. Never mutates the input array. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Words with an empty-string `meaningVi` make broken quiz questions (nothing
 * to show/guess) and broken distractors/match pairs (a blank "wrong answer"
 * or a blank match tile). Both games call this before doing anything else.
 */
export function eligibleForGames(words: VocabWordLite[]): VocabWordLite[] {
  return words.filter((w) => w.meaningVi !== "");
}

/**
 * Samples up to `count` distinct wrong-answer words from `pool`, excluding
 * `correct` and any word with an empty `meaningVi`. Returns fewer than
 * `count` (down to zero) when the pool doesn't have enough candidates —
 * never crashes/throws on a small lesson.
 */
export function sampleDistractors(
  pool: VocabWordLite[],
  correct: VocabWordLite,
  count: number,
  rng: () => number = Math.random,
): VocabWordLite[] {
  const candidates = pool.filter((w) => w.id !== correct.id && w.meaningVi !== "");
  return shuffle(candidates, rng).slice(0, Math.max(0, count));
}

export type QuizDirection = "EN_TO_VI" | "VI_TO_EN";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizRound {
  wordId: string;
  direction: QuizDirection;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
}

/**
 * Builds up to `roundCount` quiz rounds, each a random EN→VI or VI→EN
 * question with up to `optionCount` options (correct + distractors). Draws
 * rounds *without replacement* from the lesson's eligible words, so a
 * session never asks about the same word twice (see the file-level note on
 * the duplicate-wordId concern). A round needs at least 2 options to be a
 * meaningful multiple choice question; rounds that can't reach 2 (i.e. the
 * lesson has fewer than 2 eligible words total) are dropped.
 */
export function buildQuizRounds(
  words: VocabWordLite[],
  roundCount = 10,
  optionCount = 4,
  rng: () => number = Math.random,
): QuizRound[] {
  const eligible = eligibleForGames(words);
  if (eligible.length < 2) return [];

  const chosen = shuffle(eligible, rng).slice(0, roundCount);

  const rounds: QuizRound[] = [];
  for (const word of chosen) {
    const distractors = sampleDistractors(eligible, word, optionCount - 1, rng);
    const optionWords = shuffle([word, ...distractors], rng);
    if (optionWords.length < 2) continue;

    const direction: QuizDirection = rng() < 0.5 ? "EN_TO_VI" : "VI_TO_EN";
    rounds.push({
      wordId: word.id,
      direction,
      prompt: direction === "EN_TO_VI" ? word.word : word.meaningVi,
      options: optionWords.map((w) => ({
        id: w.id,
        text: direction === "EN_TO_VI" ? w.meaningVi : w.word,
      })),
      correctOptionId: word.id,
    });
  }
  return rounds;
}

export interface MatchPair {
  wordId: string;
  word: string;
  meaningVi: string;
}

export interface MatchRound {
  /** Canonical pairs for this round (correctness checks against this). */
  pairs: MatchPair[];
  /** Shuffled order for the EN column. */
  left: MatchPair[];
  /** Shuffled order for the VI column. */
  right: MatchPair[];
}

/**
 * Chunks the lesson's eligible words into rounds of up to `pairsPerRound`
 * pairs each, shuffling both columns independently. Draws from the eligible
 * pool without replacement across the *entire* session (all rounds
 * combined), so — same as the quiz — no wordId ever repeats within one
 * game session. A trailing chunk of fewer than 2 words is dropped (not
 * enough to form a meaningful match round on its own).
 */
export function buildMatchRounds(
  words: VocabWordLite[],
  pairsPerRound = 6,
  rng: () => number = Math.random,
): MatchRound[] {
  const eligible = eligibleForGames(words);
  if (eligible.length < 2) return [];

  const shuffled = shuffle(eligible, rng);
  const rounds: MatchRound[] = [];
  for (let i = 0; i < shuffled.length; i += pairsPerRound) {
    const chunk = shuffled.slice(i, i + pairsPerRound);
    if (chunk.length < 2) break;

    const pairs: MatchPair[] = chunk.map((w) => ({
      wordId: w.id,
      word: w.word,
      meaningVi: w.meaningVi,
    }));
    rounds.push({
      pairs,
      left: shuffle(pairs, rng),
      right: shuffle(pairs, rng),
    });
  }
  return rounds;
}
