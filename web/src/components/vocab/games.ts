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
  /** Null khi từ này chưa có file phát âm — khi đó không render nút loa. */
  audioUrl: string | null;
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
 * Dựng MỘT câu trắc nghiệm cho đúng từ `word`, lấy đáp án nhiễu từ `pool`.
 *
 * Tách riêng khỏi `buildQuizRounds` vì phiên luyện tập (`session-engine`)
 * quyết định hỏi từ nào theo hàng đợi ôn lại, chứ không bốc sẵn một mẻ câu
 * hỏi từ đầu. Trả `null` khi không gom nổi 2 lựa chọn — một câu trắc nghiệm
 * chỉ có một đáp án thì vô nghĩa.
 */
export function buildQuizRound(
  word: VocabWordLite,
  pool: VocabWordLite[],
  optionCount = 4,
  rng: () => number = Math.random,
  direction?: QuizDirection,
): QuizRound | null {
  if (word.meaningVi === "") return null;
  const distractors = sampleDistractors(pool, word, optionCount - 1, rng);
  const optionWords = shuffle([word, ...distractors], rng);
  if (optionWords.length < 2) return null;

  const dir: QuizDirection = direction ?? (rng() < 0.5 ? "EN_TO_VI" : "VI_TO_EN");
  return {
    wordId: word.id,
    direction: dir,
    prompt: dir === "EN_TO_VI" ? word.word : word.meaningVi,
    options: optionWords.map((w) => ({
      id: w.id,
      text: dir === "EN_TO_VI" ? w.meaningVi : w.word,
    })),
    correctOptionId: word.id,
  };
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
    const round = buildQuizRound(word, eligible, optionCount, rng);
    if (round !== null) rounds.push(round);
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
 * Dựng MỘT bàn ghép cặp từ đúng tập từ được đưa vào, không tự chia chặng —
 * việc chia chặng thuộc về `session-engine`. Trả `null` khi chưa đủ 2 từ
 * hợp lệ để thành một bàn.
 */
export function buildMatchRound(
  words: VocabWordLite[],
  rng: () => number = Math.random,
): MatchRound | null {
  const eligible = eligibleForGames(words);
  if (eligible.length < 2) return null;

  const pairs: MatchPair[] = eligible.map((w) => ({
    wordId: w.id,
    word: w.word,
    meaningVi: w.meaningVi,
  }));
  return { pairs, left: shuffle(pairs, rng), right: shuffle(pairs, rng) };
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

export type ResultTier = "excellent" | "good" | "review";

/**
 * Xếp hạng một phiên luyện tập theo tỉ lệ đúng, dùng chung cho màn hình
 * kết thúc của cả ba game. Phiên rỗng (`total === 0`) trả "review" thay vì
 * chia cho 0.
 */
export function resultTier(correct: number, total: number): ResultTier {
  if (total <= 0) return "review";
  const ratio = correct / total;
  if (ratio >= 0.9) return "excellent";
  if (ratio >= 0.7) return "good";
  return "review";
}

export type SwipeOutcome = "know" | "dont-know" | "none";

/**
 * Quy đổi quãng kéo ngang của một thẻ ghi nhớ thành hành động tự đánh giá:
 * kéo sang phải = đã nhớ, sang trái = chưa nhớ, chưa đủ ngưỡng = thả về chỗ cũ.
 */
export function resolveSwipe(dx: number, threshold: number): SwipeOutcome {
  if (dx >= threshold) return "know";
  if (dx <= -threshold) return "dont-know";
  return "none";
}

/**
 * Chuẩn hoá phiên âm về đúng một cặp gạch chéo.
 *
 * Dữ liệu từ `vocabulary.md` không nhất quán: phần lớn từ đã có sẵn dạng
 * `/weɪk ʌp/`, một số ít thì không. Trước đây UI luôn bọc thêm `/.../` nên
 * đa số từ hiện ra thành `//weɪk ʌp//`. Trả chuỗi rỗng khi không có gì để
 * hiển thị, để UI ẩn hẳn dòng phiên âm thay vì hiện `//`.
 */
export function formatIpa(ipa: string): string {
  const core = ipa.trim().replace(/^\/+/, "").replace(/\/+$/, "").trim();
  return core === "" ? "" : `/${core}/`;
}

export interface EmphasisSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Tách một dòng chữ có đánh dấu Markdown tối giản thành các đoạn có/không
 * in đậm, in nghiêng.
 *
 * 862/3.178 câu ví dụ trong `vocabulary.md` viết từ khoá dạng `**wake up**`,
 * một số câu còn bọc nghiêng cả câu dạng `*...*`. Trước đây UI in thẳng
 * chuỗi thô nên người học thấy nguyên dấu sao trên thẻ.
 *
 * Trả về đoạn thay vì JSX để hàm ở lại tầng logic thuần và test được không
 * cần DOM; component chỉ việc ánh xạ đoạn sang <strong>/<em>.
 */
export function parseInlineEmphasis(input: string): EmphasisSegment[] {
  if (input === "") return [];

  let text = input;
  let baseItalic = false;

  // Bọc nghiêng toàn câu: chỉ gỡ khi bên trong không còn dấu sao lẻ nào
  // (tránh cắt nhầm chuỗi kiểu "*a* và *b*").
  if (text.length > 2 && text.startsWith("*") && text.endsWith("*") && !text.startsWith("**")) {
    const inner = text.slice(1, -1);
    if (!inner.replaceAll("**", "").includes("*")) {
      text = inner;
      baseItalic = true;
    }
  }

  const segments: EmphasisSegment[] = [];
  const boldPattern = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index), bold: false, italic: baseItalic });
    }
    segments.push({ text: match[1], bold: true, italic: baseItalic });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), bold: false, italic: baseItalic });
  }

  return segments.filter((s) => s.text !== "");
}
