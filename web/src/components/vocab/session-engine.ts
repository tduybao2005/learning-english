/**
 * Engine của phiên luyện tập từ vựng — thuần, không React, không fetch.
 *
 * Một phiên chia các từ thành **chặng**; mỗi chặng phát một bàn ghép cặp rồi
 * tới các câu quiz của chính những từ vừa ghép. Từ nào trả lời sai sẽ vào
 * **hàng đợi ôn lại** và được hỏi lại xen giữa dòng chảy đó, cho tới khi
 * người học trả lời đúng liên tiếp đủ số lần. Phiên chỉ kết thúc khi hết kế
 * hoạch VÀ hàng đợi rỗng, nên số câu tự dài ra đúng bằng phần từ còn yếu.
 *
 * Engine chỉ làm việc với `wordId` — nó nói "hỏi từ này", không dựng câu hỏi.
 * Phần dựng bàn ghép cặp / câu trắc nghiệm (đảo thứ tự, chọn đáp án nhiễu)
 * vẫn nằm ở `games.ts`. Tách vậy để thuật toán hàng đợi test được bằng dữ
 * liệu chuỗi thuần, không phải mock `rng`.
 */

export interface ReviewResult {
  wordId: string;
  correct: boolean;
}

export type PlanStep =
  | { kind: "match"; stageIndex: number; wordIds: string[] }
  | { kind: "quiz"; stageIndex: number; wordId: string; review: boolean };

interface ReviewItem {
  wordId: string;
  /** Số lần trả lời đúng liên tiếp kể từ lần sai gần nhất. */
  streak: number;
  /** Số thứ tự bước sớm nhất được phép hỏi lại từ này. */
  dueAt: number;
}

export interface SessionState {
  /** Các chặng, theo thứ tự; mỗi chặng là danh sách wordId. */
  stages: string[][];
  plan: PlanStep[];
  planIndex: number;
  queue: ReviewItem[];
  /** Số bước đã trả lời. Bước kế tiếp mang số thứ tự `stepCount + 1`. */
  stepCount: number;
  /** Thứ tự các từ đã được hỏi trắc nghiệm ít nhất một lần. */
  asked: string[];
  wrongOnce: string[];
  reviewsServed: number;
  totalWords: number;
}

/** Khoảng cách (số bước) trước khi hỏi lại một từ vừa trả lời sai. */
export const REVIEW_GAP_AFTER_WRONG = 3;
/** Khoảng cách dài hơn sau một lần đúng — giãn dần theo kiểu Leitner. */
export const REVIEW_GAP_AFTER_CORRECT = 6;
/** Số lần đúng liên tiếp cần có để một từ rời hàng đợi. */
export const REQUIRED_STREAK = 2;
/**
 * Trần an toàn: sau ngần này câu ôn lại trong một phiên, yêu cầu hạ xuống
 * còn một lần đúng. Không có nó, một người liên tục sai cùng một từ sẽ bị
 * kẹt trong phiên không bao giờ kết thúc.
 */
export const MAX_REVIEW_STEPS = 40;

const DEFAULT_STAGE_SIZE = 6;
/** Chặng cuối ngắn hơn ngần này thì dồn vào chặng trước cho khỏi lẻ loi. */
const MIN_TAIL_STAGE = 3;

/**
 * Chia danh sách từ thành các chặng `stageSize` từ, giữ nguyên thứ tự đầu
 * vào (thứ tự đó đã được `getTopicSessionWords` xếp theo mức độ cần ôn).
 */
export function buildStages(wordIds: string[], stageSize = DEFAULT_STAGE_SIZE): string[][] {
  const stages: string[][] = [];
  for (let i = 0; i < wordIds.length; i += stageSize) {
    stages.push(wordIds.slice(i, i + stageSize));
  }
  const last = stages[stages.length - 1];
  if (stages.length > 1 && last.length < MIN_TAIL_STAGE) {
    stages.pop();
    stages[stages.length - 1] = [...stages[stages.length - 1], ...last];
  }
  return stages;
}

function buildPlan(stages: string[][]): PlanStep[] {
  const plan: PlanStep[] = [];
  stages.forEach((wordIds, stageIndex) => {
    plan.push({ kind: "match", stageIndex, wordIds });
    for (const wordId of wordIds) {
      plan.push({ kind: "quiz", stageIndex, wordId, review: false });
    }
  });
  return plan;
}

export function createSession(
  wordIds: string[],
  { stageSize = DEFAULT_STAGE_SIZE }: { stageSize?: number } = {},
): SessionState {
  const stages = buildStages(wordIds, stageSize);
  return {
    stages,
    plan: buildPlan(stages),
    planIndex: 0,
    queue: [],
    stepCount: 0,
    asked: [],
    wrongOnce: [],
    reviewsServed: 0,
    totalWords: wordIds.length,
  };
}

function requiredStreak(state: SessionState): number {
  return state.reviewsServed >= MAX_REVIEW_STEPS ? 1 : REQUIRED_STREAK;
}

function stageIndexOf(state: SessionState, wordId: string): number {
  const index = state.stages.findIndex((stage) => stage.includes(wordId));
  return index === -1 ? 0 : index;
}

function dueItem(state: SessionState): ReviewItem | null {
  const nextStepNumber = state.stepCount + 1;
  const due = state.queue.filter((item) => item.dueAt <= nextStepNumber);
  const pool = due.length > 0 ? due : state.planIndex >= state.plan.length ? state.queue : [];
  if (pool.length === 0) return null;
  // Mục quá hạn lâu nhất được hỏi trước.
  return pool.reduce((earliest, item) => (item.dueAt < earliest.dueAt ? item : earliest));
}

/**
 * Bước tiếp theo, hoặc `null` khi phiên đã xong. Hàng đợi ôn lại luôn được
 * ưu tiên hơn kế hoạch; khi kế hoạch đã hết mà hàng đợi chưa tới hạn thì bỏ
 * qua khoảng chờ (chờ tiếp cũng chẳng còn câu nào xen vào).
 */
export function peekStep(state: SessionState): PlanStep | null {
  const item = dueItem(state);
  if (item !== null) {
    return {
      kind: "quiz",
      stageIndex: stageIndexOf(state, item.wordId),
      wordId: item.wordId,
      review: true,
    };
  }
  return state.plan[state.planIndex] ?? null;
}

/**
 * Ghi nhận kết quả của bước hiện tại. `wrongWordIds` là những từ trả lời sai
 * — rỗng nghĩa là đúng hết. Với bàn ghép cặp, chỉ tính từ tiếng Anh mà người
 * học bấm nhầm, không tính ô nghĩa.
 */
export function submitStep(state: SessionState, wrongWordIds: string[]): SessionState {
  const step = peekStep(state);
  if (step === null) return state;

  const isReview = step.kind === "quiz" && step.review;
  const stepWordIds = step.kind === "match" ? step.wordIds : [step.wordId];
  const wrong = new Set(wrongWordIds.filter((id) => stepWordIds.includes(id)));
  const stepCount = state.stepCount + 1;

  const asked = [...state.asked];
  const wrongOnce = [...state.wrongOnce];
  let queue = state.queue.map((item) => ({ ...item }));

  for (const wordId of stepWordIds) {
    // Chỉ câu trắc nghiệm mới tính là "đã hỏi": bàn ghép cặp là bước khởi
    // động của chặng, ghép xong mà thanh tiến độ nhảy lên 100% trong khi
    // còn nguyên loạt câu hỏi phía sau thì con số đó vô nghĩa.
    if (step.kind === "quiz" && !asked.includes(wordId)) asked.push(wordId);

    if (wrong.has(wordId)) {
      if (!wrongOnce.includes(wordId)) wrongOnce.push(wordId);
      const existing = queue.find((item) => item.wordId === wordId);
      const dueAt = stepCount + REVIEW_GAP_AFTER_WRONG;
      if (existing) {
        existing.streak = 0;
        existing.dueAt = dueAt;
      } else {
        queue.push({ wordId, streak: 0, dueAt });
      }
      continue;
    }

    const existing = queue.find((item) => item.wordId === wordId);
    if (existing === undefined) continue;
    existing.streak += 1;
    existing.dueAt = stepCount + REVIEW_GAP_AFTER_CORRECT;
  }

  const reviewsServed = state.reviewsServed + (isReview ? 1 : 0);
  // Ngưỡng được tính SAU khi cộng `reviewsServed`, để bước vừa chạm trần
  // cũng được hưởng yêu cầu đã hạ — nếu không, phiên phải tốn thêm một câu
  // nữa mới thoát được.
  const needed = requiredStreak({ ...state, reviewsServed });
  queue = queue.filter((item) => item.streak < needed);

  return {
    ...state,
    planIndex: isReview ? state.planIndex : state.planIndex + 1,
    queue,
    stepCount,
    asked,
    wrongOnce,
    reviewsServed,
  };
}

export interface SessionStats {
  total: number;
  /** Số từ đã trả lời trắc nghiệm và không còn nợ câu ôn lại nào. */
  done: number;
  pendingReview: number;
}

export function sessionStats(state: SessionState): SessionStats {
  const pending = new Set(state.queue.map((item) => item.wordId));
  return {
    total: state.totalWords,
    done: state.asked.filter((wordId) => !pending.has(wordId)).length,
    pendingReview: pending.size,
  };
}

/**
 * Kết quả gửi lên `/api/vocab/review`: đúng MỘT dòng cho mỗi từ đã trả lời
 * trắc nghiệm,
 * `correct` chỉ đúng khi từ đó chưa sai lần nào trong cả phiên.
 *
 * Một từ có thể được hỏi nhiều lần trong phiên, nhưng `applyReviewResults`
 * tính mọi kết quả trên cùng một ảnh chụp trước lô, nên gửi trùng wordId sẽ
 * cho ra chuyển hộp Leitner sai. Gộp về một dòng ở đây giữ nguyên hợp đồng
 * mà API đang dựa vào (xem ghi chú đầu `games.ts`).
 */
export function sessionResults(state: SessionState): ReviewResult[] {
  return state.asked.map((wordId) => ({
    wordId,
    correct: !state.wrongOnce.includes(wordId),
  }));
}
