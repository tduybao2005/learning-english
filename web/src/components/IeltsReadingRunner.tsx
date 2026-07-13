"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/MarkdownContent";
import { QuestionCard, type SafeQuestion } from "@/components/runner/QuestionCard";
import { celebrate } from "@/lib/celebrate";

/** Một nhóm câu hỏi kèm hướng dẫn của nó, đã ghép với câu hỏi thật từ DB. */
export interface RunnerGroup {
  title: string;
  instructionsMd: string;
  questions: SafeQuestion[];
}

export interface RunnerPassage {
  title: string;
  passageMd: string;
  groups: RunnerGroup[];
}

/** Kết quả chấm — chỉ tồn tại SAU khi nộp; server không gửi trước. */
interface Result {
  questionId: string;
  number: number;
  correct: boolean;
  correctAnswer: string;
  explanation: string | null;
}

interface SubmitResponse {
  rawScore: number;
  band: number;
  results: Result[];
}

/**
 * Làm bài Reading ngay trên trang: mỗi câu là một `QuestionCard` (MCQ ra lựa
 * chọn, completion ra ô nhập), nộp cả bài một lần, rồi hiện ✓/✗ + đáp án đúng +
 * giải thích cho từng câu.
 *
 * Đáp án KHÔNG có trong props: trang server chỉ gửi đề, còn đáp án chỉ về theo
 * response của `/api/ielts/[n]/submit`. Đó là điều kiện để bài thi có nghĩa —
 * bản cũ đổ sẵn cả answer key vào HTML.
 */
export function IeltsReadingRunner({
  testNumber,
  passages,
  totalQuestions,
}: {
  testNumber: number;
  passages: RunnerPassage[];
  totalQuestions: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitted = outcome !== null;
  const answeredCount = Object.values(answers).filter((v) => v.trim() !== "").length;

  const resultByQuestion = new Map(outcome?.results.map((r) => [r.questionId, r]) ?? []);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ielts/${testNumber}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, answerText]) => ({
            questionId,
            answerText,
          })),
        }),
      });
      if (!res.ok) {
        setError("Không nộp được bài. Vui lòng thử lại.");
        return;
      }
      const json: SubmitResponse = await res.json();
      setOutcome(json);
      celebrate();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Không nộp được bài. Vui lòng kiểm tra kết nối.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Thanh trạng thái: đang làm ?/40, hoặc kết quả sau khi nộp. */}
      {submitted ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/40 bg-success-bg p-6 text-center">
          <p className="text-caption font-semibold text-muted-foreground">Kết quả</p>
          <p className="text-h1 font-extrabold text-success">
            {outcome.rawScore}/{totalQuestions}
          </p>
          <p className="text-lg font-bold">
            Band Reading: <span className="text-primary">{outcome.band.toFixed(1)}</span>
          </p>
          {/* Nói rõ để người học không nhầm với band tổng của cả đề. */}
          <p className="text-caption text-muted-foreground">
            Đây là band của riêng kỹ năng Reading, không phải band tổng của đề (band tổng cần đủ 4 kỹ năng).
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-3">
          <span className="text-caption font-semibold text-muted-foreground">
            Đã trả lời {answeredCount}/{totalQuestions}
          </span>
          <div className="h-2 w-32 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      )}

      {passages.map((passage, pi) => (
        <div key={pi} className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="rounded-2xl border border-border bg-card p-5 lg:max-h-[80vh] lg:overflow-y-auto">
            <MarkdownContent content={passage.passageMd} />
          </div>

          <div className="flex flex-col gap-4">
            {passage.groups.map((group, gi) => (
              <div key={gi} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-2 text-base font-bold">{group.title}</h3>
                {group.instructionsMd.trim() !== "" && (
                  <div className="mb-4 rounded-xl bg-muted/60 p-4 text-sm">
                    <MarkdownContent content={group.instructionsMd} />
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {group.questions.map((question) => {
                    const result = resultByQuestion.get(question.id);
                    return (
                      <div
                        key={question.id}
                        className={cn(
                          "rounded-xl border p-4",
                          result?.correct && "border-success/50 bg-success-bg",
                          result && !result.correct && "border-destructive/50 bg-destructive/5",
                          !result && "border-border",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                            {question.number}
                          </span>
                          {result && (
                            <span
                              className={cn(
                                "text-sm font-bold",
                                result.correct ? "text-success" : "text-destructive",
                              )}
                            >
                              {result.correct ? "✓ Đúng" : "✗ Sai"}
                            </span>
                          )}
                        </div>

                        <QuestionCard
                          question={question}
                          disabled={submitted}
                          status={
                            result ? (result.correct ? "correct" : "incorrect") : "answering"
                          }
                          onChangeInput={(value) =>
                            setAnswers((prev) => ({ ...prev, [question.id]: value }))
                          }
                        />

                        {result && !result.correct && (
                          <div className="mt-3 flex flex-col gap-2 text-sm">
                            <p className="text-muted-foreground">
                              Đáp án:{" "}
                              <span className="font-semibold text-success">
                                {result.correctAnswer}
                              </span>
                            </p>
                            {result.explanation && (
                              <div className="rounded-xl border border-border bg-card p-3">
                                <p className="mb-1 text-caption font-bold text-primary">
                                  💡 Giải thích
                                </p>
                                <p className="leading-relaxed">{result.explanation}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive-bg p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {!submitted && (
        // Sticky ở mobile: bài dài 3 khổ, nút nộp không được trôi mất tăm.
        <div className="sticky bottom-4 z-10 flex justify-center">
          <Button
            size="lg"
            className="w-full shadow-primary-glow sm:w-auto"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Đang chấm..." : `Nộp bài (${answeredCount}/${totalQuestions})`}
          </Button>
        </div>
      )}
    </div>
  );
}
