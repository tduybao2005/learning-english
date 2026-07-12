import type { QuestionKind } from "@/lib/grading/match";
import { matchAnswer } from "@/lib/grading/match";

export interface GradableQuestion {
  id: string;
  kind: QuestionKind;
  isOpenEnded: boolean;
  variants: { normalized: string }[];
}

/**
 * Chấm một section của bài kiểm tra đầu vào ở server: chỉ tính những câu
 * thuộc `questions` (id lạ do client gửi bị bỏ qua), chấm bằng `matchAnswer`
 * — cùng hàm chấm dùng ở mọi nơi khác — nên answer key không bao giờ rời
 * server. Câu thiếu câu trả lời được coi là bỏ trống (sai). Trả về rawScore
 * và audit map `{questionId: {text, isCorrect}}` để lưu vào
 * `PlacementAttempt.answers`.
 */
export function gradePlacementSection(
  questions: GradableQuestion[],
  answers: Record<string, string>,
): { rawScore: number; results: Record<string, { text: string; isCorrect: boolean }> } {
  let rawScore = 0;
  const results: Record<string, { text: string; isCorrect: boolean }> = {};
  for (const q of questions) {
    const text = answers[q.id] ?? "";
    const r = matchAnswer(text, { kind: q.kind, isOpenEnded: q.isOpenEnded, variants: q.variants });
    if (r.correct) rawScore++;
    results[q.id] = { text, isCorrect: r.correct };
  }
  return { rawScore, results };
}
