import { describe, expect, it } from "vitest";

import {
  MAX_REVIEW_STEPS,
  buildStages,
  createSession,
  peekStep,
  sessionResults,
  sessionStats,
  submitStep,
  type PlanStep,
  type SessionState,
} from "./session-engine";

const ids = (n: number, prefix = "w") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

/** Trả lời đúng mọi thứ cho tới khi phiên kết thúc; trả về số bước đã chơi. */
function playAllCorrect(start: SessionState, limit = 500): { state: SessionState; steps: number } {
  let state = start;
  let steps = 0;
  while (peekStep(state) !== null && steps < limit) {
    state = submitStep(state, []);
    steps++;
  }
  return { state, steps };
}

/** Trả lời đúng cho tới ngay trước câu ôn lại của `wordId`. */
function advanceUntilReviewOf(start: SessionState, wordId: string, limit = 200): SessionState {
  let state = start;
  for (let i = 0; i < limit; i++) {
    const step = peekStep(state);
    if (step === null) throw new Error(`phiên kết thúc trước khi ôn lại "${wordId}"`);
    if (step.kind === "quiz" && step.review && step.wordId === wordId) return state;
    state = submitStep(state, []);
  }
  throw new Error(`không gặp câu ôn lại của "${wordId}"`);
}

describe("buildStages", () => {
  it("chia 20 từ thành 6/6/8 — phần dư dưới 3 từ dồn vào chặng trước", () => {
    expect(buildStages(ids(20), 6).map((s) => s.length)).toEqual([6, 6, 8]);
  });

  it("giữ nguyên chặng dư từ 3 từ trở lên", () => {
    expect(buildStages(ids(9), 6).map((s) => s.length)).toEqual([6, 3]);
  });

  it("không dồn khi chỉ có đúng một chặng", () => {
    expect(buildStages(ids(2), 6).map((s) => s.length)).toEqual([2]);
  });

  it("giữ nguyên thứ tự từ đầu vào", () => {
    expect(buildStages(ids(9), 6)).toEqual([ids(6), ["w7", "w8", "w9"]]);
  });
});

describe("dòng chảy một phiên không sai câu nào", () => {
  it("mỗi chặng phát đúng một bàn ghép cặp rồi tới các câu quiz của chính chặng đó", () => {
    const state = createSession(ids(12), { stageSize: 6 });

    const first = peekStep(state);
    expect(first).toEqual({ kind: "match", stageIndex: 0, wordIds: ids(6) });

    let s = submitStep(state, []);
    for (let i = 0; i < 6; i++) {
      const step = peekStep(s);
      expect(step).toEqual({ kind: "quiz", stageIndex: 0, wordId: `w${i + 1}`, review: false });
      s = submitStep(s, []);
    }

    expect(peekStep(s)).toEqual({
      kind: "match",
      stageIndex: 1,
      wordIds: ["w7", "w8", "w9", "w10", "w11", "w12"],
    });
  });

  it("kết thúc sau đúng (số chặng × (1 bàn ghép + n câu quiz)) bước, không có câu ôn lại", () => {
    const { state, steps } = playAllCorrect(createSession(ids(12), { stageSize: 6 }));

    expect(steps).toBe(2 * (1 + 6));
    expect(peekStep(state)).toBeNull();
    expect(sessionStats(state).pendingReview).toBe(0);
  });
});

describe("hàng đợi ôn lại", () => {
  /** Chơi tới bước quiz đầu tiên của chặng 1 rồi trả lời sai từ đó. */
  function missFirstQuizWord(): SessionState {
    const state = submitStep(createSession(ids(12), { stageSize: 6 }), []); // qua bàn ghép cặp
    const step = peekStep(state);
    if (step === null || step.kind !== "quiz") throw new Error("kỳ vọng một bước quiz");
    return submitStep(state, [step.wordId]);
  }

  it("từ sai được hẹn gặp lại sau 3 bước, không hỏi lại ngay", () => {
    let s = missFirstQuizWord();
    expect(sessionStats(s).pendingReview).toBe(1);

    // 2 bước kế vẫn là quiz thường của chặng.
    for (let i = 0; i < 2; i++) {
      const step = peekStep(s);
      expect(step).not.toBeNull();
      expect((step as PlanStep & { review?: boolean }).review).toBe(false);
      s = submitStep(s, []);
    }

    expect(peekStep(s)).toEqual({ kind: "quiz", stageIndex: 0, wordId: "w1", review: true });
  });

  it("phải trả lời đúng 2 lần mới rời hàng đợi", () => {
    let s = missFirstQuizWord();
    s = submitStep(s, []);
    s = submitStep(s, []);

    // Lần ôn thứ nhất: đúng, nhưng vẫn còn trong hàng đợi.
    expect(peekStep(s)).toMatchObject({ wordId: "w1", review: true });
    s = submitStep(s, []);
    expect(sessionStats(s).pendingReview).toBe(1);

    // Lần ôn thứ hai: đúng thì mới xong.
    s = advanceUntilReviewOf(s, "w1");
    s = submitStep(s, []);
    expect(sessionStats(s).pendingReview).toBe(0);
  });

  it("sai lại khi đang ôn thì chuỗi đúng đếm lại từ đầu", () => {
    let s = missFirstQuizWord();
    s = submitStep(s, []);
    s = submitStep(s, []);
    expect(peekStep(s)).toMatchObject({ wordId: "w1", review: true });

    s = submitStep(s, []); // đúng lần 1
    s = advanceUntilReviewOf(s, "w1");

    s = submitStep(s, ["w1"]); // sai lại
    expect(sessionStats(s).pendingReview).toBe(1);

    // Vẫn cần thêm 2 lần đúng nữa.
    let reviewsOfW1 = 0;
    while (peekStep(s) !== null) {
      const step = peekStep(s)!;
      if (step.kind === "quiz" && step.review && step.wordId === "w1") reviewsOfW1++;
      s = submitStep(s, []);
    }
    expect(reviewsOfW1).toBe(2);
  });

  it("ghép cặp sai cũng đẩy đúng những từ đó vào hàng đợi", () => {
    const state = createSession(ids(12), { stageSize: 6 });
    const s = submitStep(state, ["w2", "w5"]);

    expect(sessionStats(s).pendingReview).toBe(2);
    expect(s.wrongOnce).toEqual(["w2", "w5"]);
  });

  it("phiên kéo dài quá kế hoạch cho tới khi hàng đợi rỗng", () => {
    const state = createSession(ids(6), { stageSize: 6 });
    const planned = 1 + 6;

    // Sai từ cuối cùng của chặng: kế hoạch đã hết nhưng phiên phải chạy tiếp.
    let s = state;
    for (let i = 0; i < planned - 1; i++) s = submitStep(s, []);
    const last = peekStep(s);
    expect(last).toMatchObject({ kind: "quiz", wordId: "w6" });
    s = submitStep(s, ["w6"]);

    expect(peekStep(s)).toEqual({ kind: "quiz", stageIndex: 0, wordId: "w6", review: true });

    const { state: done, steps } = playAllCorrect(s);
    expect(steps).toBe(2);
    expect(peekStep(done)).toBeNull();
  });
});

describe("trần an toàn", () => {
  it("sau MAX_REVIEW_STEPS câu ôn lại thì chỉ cần đúng 1 lần là xong", () => {
    let s = createSession(ids(6), { stageSize: 6 });
    s = submitStep(s, ["w1"]); // sai w1 ngay ở bàn ghép cặp

    let served = 0;
    while (peekStep(s) !== null && served < MAX_REVIEW_STEPS + 20) {
      const step = peekStep(s)!;
      const isW1Review = step.kind === "quiz" && step.review && step.wordId === "w1";
      if (isW1Review) served++;
      s = submitStep(s, isW1Review ? ["w1"] : []);
      if (served >= MAX_REVIEW_STEPS) break;
    }

    expect(served).toBe(MAX_REVIEW_STEPS);
    // Từ lúc này một lần đúng là đủ để kết thúc phiên.
    const { state, steps } = playAllCorrect(s, 10);
    expect(steps).toBe(1);
    expect(peekStep(state)).toBeNull();
  });
});

describe("sessionResults", () => {
  it("mỗi wordId đúng một kết quả, sai một lần trong phiên là correct=false", () => {
    let s = createSession(ids(6), { stageSize: 6 });
    s = submitStep(s, ["w3"]);
    const { state } = playAllCorrect(s);

    const results = sessionResults(state);
    expect(results).toHaveLength(6);
    expect(new Set(results.map((r) => r.wordId)).size).toBe(6);
    expect(results.find((r) => r.wordId === "w3")?.correct).toBe(false);
    expect(results.filter((r) => r.correct)).toHaveLength(5);
  });

  it("bàn ghép cặp chưa tính là đã hỏi — chỉ câu trắc nghiệm mới sinh kết quả", () => {
    const state = createSession(ids(12), { stageSize: 6 });
    expect(sessionResults(state)).toEqual([]);

    const afterMatch = submitStep(state, []);
    expect(sessionResults(afterMatch)).toEqual([]);

    const afterFirstQuiz = submitStep(afterMatch, []);
    expect(sessionResults(afterFirstQuiz).map((r) => r.wordId)).toEqual(["w1"]);
  });
});

describe("sessionStats", () => {
  it("đếm số từ đã xong để vẽ thanh tiến độ", () => {
    const state = createSession(ids(12), { stageSize: 6 });
    expect(sessionStats(state)).toMatchObject({ total: 12, done: 0, pendingReview: 0 });

    // Ghép cặp xong chưa từ nào "xong" — mới chỉ có một từ vào hàng đợi.
    const s = submitStep(state, ["w2"]);
    expect(sessionStats(s)).toMatchObject({ total: 12, done: 0, pendingReview: 1 });
  });

  it("một phiên hoàn tất có done bằng tổng số từ", () => {
    const { state } = playAllCorrect(createSession(ids(12), { stageSize: 6 }));
    expect(sessionStats(state)).toMatchObject({ total: 12, done: 12, pendingReview: 0 });
  });
});

describe("bước hiện tại khi kế hoạch đã hết", () => {
  it("bỏ qua khoảng chờ và hỏi ngay mục ôn lại còn lại", () => {
    let s = createSession(ids(6), { stageSize: 6 });
    s = submitStep(s, ["w1"]);
    for (let i = 0; i < 6; i++) s = submitStep(s, []);

    // Kế hoạch hết sạch; w1 vẫn còn nợ một lần đúng nữa.
    expect(sessionStats(s).pendingReview).toBe(1);
    expect(peekStep(s)).toMatchObject({ wordId: "w1", review: true });
  });
});
