"use client";

import { useEffect, useReducer } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initRunnerState, runnerReducer } from "@/components/runner/reducer";
import { QuestionCard, type SafeQuestion } from "@/components/runner/QuestionCard";
import { ExplanationSlot } from "@/components/runner/ExplanationSlot";

/**
 * Question-answering flow for a listening set's practice questions.
 *
 * Reuses Task 9's runner pieces (`runnerReducer`/`initRunnerState` for the
 * answering -> checking -> correct|incorrect -> finished state machine,
 * `QuestionCard` for per-kind inputs, `ExplanationSlot` for the — currently
 * always-null — future AI slot) so the interaction model matches the lesson
 * exercise runner exactly. Unlike `ExerciseRunner`, there is no persisted
 * attempt/redo and no lesson-unlock side effect: answers are checked against
 * `POST /api/listening/[slug]/check` (stateless — see that route's docstring
 * for why listening sets don't get a full ExerciseAttempt flow), and
 * "finished" is purely client-side, reported via `onFinished` so the parent
 * page can unlock the transcript reveal.
 */
export function ListeningRunner({
  slug,
  questions,
  onFinished,
}: {
  slug: string;
  questions: SafeQuestion[];
  onFinished: () => void;
}) {
  const [state, dispatch] = useReducer(runnerReducer, undefined, () =>
    initRunnerState(
      questions.map((q) => q.id),
      0,
    ),
  );

  useEffect(() => {
    if (state.phase === "finished") onFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per finish, not on every onFinished identity change
  }, [state.phase]);

  if (questions.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Bài nghe này chưa có câu hỏi.
      </p>
    );
  }

  const total = questions.length;
  const question = questions[state.index];

  async function handleSubmit() {
    if (state.phase !== "answering" && state.phase !== "incorrect") return;
    if (state.input.trim() === "") return;

    const answerText = state.input;
    dispatch({ type: "SUBMIT" });

    const res = await fetch(`/api/listening/${slug}/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: question.id, answerText }),
    });
    const json = await res.json();
    dispatch({ type: "RESULT", result: json });
  }

  if (state.phase === "finished") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/50 bg-success-bg p-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="text-lg font-bold">Hoàn thành phần câu hỏi!</h2>
        <p className="text-sm text-muted-foreground">Bây giờ bạn có thể xem transcript bên dưới.</p>
      </div>
    );
  }

  if (!question) return null;

  const percent = Math.round((state.index / total) * 100);
  const isChecking = state.phase === "checking";
  const isIncorrect = state.phase === "incorrect";
  const isCorrect = state.phase === "correct";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Câu {state.index + 1}/{total}
          </span>
          {isIncorrect && <span>Lần thử: {state.tries}</span>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary animate-progress-fill transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border p-5 transition-colors",
          isIncorrect && "border-destructive/50 bg-destructive/5",
          isCorrect && "border-success/50 bg-success-bg",
          !isIncorrect && !isCorrect && "border-border bg-card",
        )}
      >
        <QuestionCard
          key={question.id}
          question={question}
          status={state.phase}
          disabled={isChecking || isCorrect}
          onChangeInput={(value) => dispatch({ type: "SET_INPUT", value })}
        />

        {isIncorrect && (
          <div className="mt-3">
            <p className="text-sm font-medium text-destructive">Chưa đúng, thử lại.</p>
            <ExplanationSlot explanation={state.result?.explanation ?? null} />
          </div>
        )}

        {isCorrect && (
          <div className="mt-3 text-sm">
            <p className="font-medium text-emerald-600 dark:text-emerald-400">Chính xác!</p>
            {state.result?.correctAnswer && (
              <p className="text-muted-foreground">
                Đáp án: <span className="font-medium text-foreground">{state.result.correctAnswer}</span>
              </p>
            )}
            {state.result?.keyNote && <p className="text-muted-foreground">{state.result.keyNote}</p>}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          {isCorrect ? (
            <Button onClick={() => dispatch({ type: "CONTINUE" })}>Tiếp tục</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isChecking || state.input.trim() === ""}>
              {isIncorrect ? "Thử lại" : "Kiểm tra"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
