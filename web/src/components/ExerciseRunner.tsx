"use client";

import { useReducer, useRef, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { initRunnerState, runnerReducer } from "@/components/runner/reducer";
import { QuestionCard, type SafeQuestion, type SafeQuestionKind } from "@/components/runner/QuestionCard";
import { ExplanationSlot } from "@/components/runner/ExplanationSlot";
import { useRunnerShortcuts } from "@/components/runner/useRunnerShortcuts";

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
  /** Where the top bar's close `✕` navigates back to (the lesson overview). */
  backHref: string;
}

/** Kicker line shown above the prompt, keyed off the question's kind. */
function kickerFor(kind: SafeQuestionKind): string {
  switch (kind) {
    case "MULTIPLE_CHOICE":
      return "Chọn đáp án đúng";
    case "FILL_BLANK":
      return "Điền vào chỗ trống";
    default:
      return "Trả lời câu hỏi";
  }
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
  backHref,
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
      backHref={backHref}
    />
  );
}

function ExerciseRunnerSession({
  attemptId,
  initialQuestionNumber,
  questions,
  nextLesson,
  onRedo,
  backHref,
}: {
  attemptId: string;
  initialQuestionNumber: number;
  questions: SafeQuestion[];
  nextLesson: NextLessonInfo | null;
  onRedo: () => void;
  backHref: string;
}) {
  const [state, dispatch] = useReducer(runnerReducer, undefined, () =>
    initRunnerState(
      questions.map((q) => q.id),
      initialQuestionNumber - 1,
    ),
  );

  const total = questions.length;
  const question = questions[state.index];
  const cardRef = useRef<HTMLDivElement | null>(null);

  useRunnerShortcuts({
    containerRef: cardRef,
    onPrimaryAction: () => {
      if (state.phase === "correct") dispatch({ type: "CONTINUE" });
      else void handleSubmit(); // guards handle checking/empty
    },
  });

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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center lg:mx-auto lg:max-w-xl">
        <div className="flex size-16 items-center justify-center rounded-full bg-success text-2xl text-success-foreground animate-pop">
          ✓
        </div>
        <h2 className="text-h2 font-extrabold">Hoàn thành bài tập!</h2>
        {nextLesson ? (
          <span className="rounded-full bg-streak-bg px-3 py-1.5 text-sm font-semibold text-streak-foreground">
            Đã mở khoá: {nextLesson.title}
          </span>
        ) : (
          <p className="text-muted-foreground">Bạn đã hoàn thành toàn bộ lộ trình hiện có!</p>
        )}
        <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}
          >
            Về lộ trình học
          </Link>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onRedo}>
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
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Đóng bài tập"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            ✕
          </Link>
          <div className="h-2 flex-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary animate-progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-caption font-medium text-muted-foreground">
            Câu {state.index + 1}/{total}
          </span>
        </div>
        {isIncorrect && (
          <p className="text-right text-caption text-muted-foreground">Lần thử: {state.tries}</p>
        )}
      </div>

      <div ref={cardRef} className="flex w-full flex-col gap-3 lg:mx-auto lg:max-w-[720px]">
        <p className="text-caption font-semibold text-primary lg:text-center">
          {kickerFor(question.kind)}
        </p>

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
            disabled={isChecking || isCorrect}
            status={state.phase}
            onChangeInput={(value) => dispatch({ type: "SET_INPUT", value })}
            emphasizePrompt
          />

          {isCorrect && (
            <div className="mt-3 text-sm">
              <p className="font-medium text-success">Chính xác!</p>
              {state.result?.correctAnswer && (
                <p className="text-muted-foreground">
                  Đáp án: <span className="font-medium text-foreground">{state.result.correctAnswer}</span>
                </p>
              )}
              {state.result?.keyNote && <p className="text-muted-foreground">{state.result.keyNote}</p>}
            </div>
          )}

          {/* Card footer: the single primary action lives INSIDE the card. */}
          <div className="mt-4 flex justify-end border-t border-border/60 pt-4">
            {isCorrect ? (
              <Button className="w-full sm:w-auto" onClick={() => dispatch({ type: "CONTINUE" })}>
                Tiếp tục
              </Button>
            ) : (
              <Button
                className="w-full sm:w-auto"
                variant={isIncorrect ? "outline" : "default"}
                onClick={handleSubmit}
                disabled={isChecking || state.input.trim() === ""}
              >
                {isIncorrect ? "Thử lại" : "Kiểm tra"}
              </Button>
            )}
          </div>
        </div>

        {isIncorrect && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-destructive">Chưa đúng, thử lại.</p>
            {state.result?.keyNote && (
              <div className="rounded-xl border border-destructive/30 bg-destructive-bg p-4">
                <p className="mb-1 text-caption font-bold text-destructive">💡 Ghi nhớ</p>
                <p className="text-sm leading-relaxed">{state.result.keyNote}</p>
              </div>
            )}
            <ExplanationSlot explanation={state.result?.explanation ?? null} />
          </div>
        )}
      </div>
    </div>
  );
}
