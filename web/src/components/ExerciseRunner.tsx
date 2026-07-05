"use client";

import { useReducer, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { initRunnerState, runnerReducer } from "@/components/runner/reducer";
import { QuestionCard, type SafeQuestion } from "@/components/runner/QuestionCard";
import { ExplanationSlot } from "@/components/runner/ExplanationSlot";

export interface NextLessonInfo {
  slug: string;
  phaseSlug: string;
  title: string;
}

interface ExerciseRunnerProps {
  exerciseId: string;
  attemptId: string;
  initialQuestionNumber: number;
  questions: SafeQuestion[];
  nextLesson: NextLessonInfo | null;
}

/**
 * Owns which attempt is "current" (`session`). Redo swaps in a brand new
 * attemptId/startNumber and remounts `ExerciseRunnerSession` via `key`, which
 * is the simplest way to get a fully-reset reducer without a dedicated
 * RESET action.
 */
export function ExerciseRunner({
  exerciseId,
  attemptId,
  initialQuestionNumber,
  questions,
  nextLesson,
}: ExerciseRunnerProps) {
  const [session, setSession] = useState({ attemptId, initialQuestionNumber });

  async function handleRedo() {
    const res = await fetch(`/api/exercises/${exerciseId}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redo: true }),
    });
    const json = await res.json();
    setSession({ attemptId: json.attemptId, initialQuestionNumber: json.currentQuestionNumber });
  }

  if (questions.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Bài tập này chưa có câu hỏi.
      </p>
    );
  }

  return (
    <ExerciseRunnerSession
      key={session.attemptId}
      attemptId={session.attemptId}
      initialQuestionNumber={session.initialQuestionNumber}
      questions={questions}
      nextLesson={nextLesson}
      onRedo={handleRedo}
    />
  );
}

function ExerciseRunnerSession({
  attemptId,
  initialQuestionNumber,
  questions,
  nextLesson,
  onRedo,
}: {
  attemptId: string;
  initialQuestionNumber: number;
  questions: SafeQuestion[];
  nextLesson: NextLessonInfo | null;
  onRedo: () => void;
}) {
  const [state, dispatch] = useReducer(runnerReducer, undefined, () =>
    initRunnerState(
      questions.map((q) => q.id),
      initialQuestionNumber - 1,
    ),
  );

  const total = questions.length;
  const question = questions[state.index];

  async function handleSubmit() {
    if (state.phase !== "answering" && state.phase !== "incorrect") return;
    if (state.input.trim() === "") return;

    const answerText = state.input;
    dispatch({ type: "SUBMIT" });

    const res = await fetch(`/api/attempts/${attemptId}/answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: question.id, answerText }),
    });
    const json = await res.json();
    dispatch({ type: "RESULT", result: json });
  }

  if (state.phase === "finished") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">Hoàn thành bài tập!</h2>
        {nextLesson ? (
          <p className="text-muted-foreground">
            Mở khóa: <span className="font-medium text-foreground">{nextLesson.title}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">Bạn đã hoàn thành toàn bộ lộ trình hiện có!</p>
        )}
        <div className="mt-3 flex gap-3">
          {nextLesson && (
            <Link
              href={`/learn/${nextLesson.phaseSlug}/${nextLesson.slug}`}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Bài tiếp theo
            </Link>
          )}
          <Button variant="outline" onClick={onRedo}>
            Làm lại
          </Button>
        </div>
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
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border p-5 transition-colors",
          isIncorrect && "border-destructive/50 bg-destructive/5",
          isCorrect && "border-emerald-500/50 bg-emerald-500/5",
          !isIncorrect && !isCorrect && "border-border bg-card",
        )}
      >
        <QuestionCard
          key={question.id}
          question={question}
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
