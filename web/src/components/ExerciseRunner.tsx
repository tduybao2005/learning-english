"use client";

import { useEffect, useReducer, useRef, useState } from "react";

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
  /** Questions already answered in a PRIOR session, hydrated from the server
   * so "← Câu trước" works immediately on resume (without this, `past` starts
   * empty and the button is dead until the learner answers one more here). */
  initialPast?: PastAnswer[];
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
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
  initialPast,
  linkComponent,
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
      // Hydrated history only applies to the attempt we resumed. A redo swaps
      // in a brand-new attempt, whose history must start empty.
      initialPast={session.attemptId === attemptId ? initialPast : undefined}
      linkComponent={linkComponent}
    />
  );
}

/** One already-answered question, captured client-side when the learner
 * advances past it. Purely for read-only review — nothing here is re-sent. */
export interface PastAnswer {
  index: number;
  answerText: string;
  correctAnswer?: string | null;
  keyNote?: string | null;
}

/** Read-only view of an earlier question: the prompt, what the learner
 * submitted, and the correct answer. Deliberately renders no input at all
 * (QuestionCard is uncontrolled and would show an empty field), and never
 * touches the attempt API. */
function ReviewCard({
  question,
  past,
  total,
  onPrev,
  onNext,
  onExit,
}: {
  question: SafeQuestion;
  past: PastAnswer;
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onExit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-muted px-3 py-1 text-caption font-semibold text-muted-foreground">
          Xem lại — Câu {past.index + 1}/{total}
        </span>
        <Button variant="ghost" size="sm" onClick={onExit}>
          Quay lại câu hiện tại
        </Button>
      </div>

      <div className="flex w-full flex-col gap-3 lg:mx-auto lg:max-w-[720px]">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="whitespace-pre-line text-base leading-relaxed">{question.prompt}</p>

          <div className="mt-4 flex flex-col gap-1 border-t border-border/60 pt-4 text-sm">
            <p className="text-muted-foreground">
              Câu trả lời của bạn:{" "}
              <span className="font-medium text-foreground">{past.answerText}</span>
            </p>
            {past.correctAnswer && (
              <p className="text-muted-foreground">
                Đáp án: <span className="font-medium text-success">{past.correctAnswer}</span>
              </p>
            )}
            {past.keyNote && <p className="text-muted-foreground">{past.keyNote}</p>}
          </div>
        </div>

        <div className="flex justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => onPrev?.()} disabled={!onPrev}>
            ← Câu trước
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNext?.()} disabled={!onNext}>
            Câu sau →
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExerciseRunnerSession({
  attemptId,
  initialQuestionNumber,
  questions,
  nextLesson,
  onRedo,
  backHref,
  initialPast,
  linkComponent: Link,
}: {
  attemptId: string;
  initialQuestionNumber: number;
  questions: SafeQuestion[];
  nextLesson: NextLessonInfo | null;
  onRedo: () => void;
  backHref: string;
  initialPast?: PastAnswer[];
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
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
  const [past, setPast] = useState<PastAnswer[]>(initialPast ?? []);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  // Bumped on "Làm lại" to force QuestionCard (uncontrolled) to remount and
  // clear its local input, since the question id itself doesn't change.
  const [redoTick, setRedoTick] = useState(0);

  function handleRedoQuestion() {
    setRedoTick((t) => t + 1);
    dispatch({ type: "REDO_QUESTION" });
  }

  function handleContinue() {
    setPast((prev) => [
      ...prev,
      {
        index: state.index,
        answerText: state.input,
        correctAnswer: state.result?.correctAnswer ?? null,
        keyNote: state.result?.keyNote ?? null,
      },
    ]);
    dispatch({ type: "CONTINUE" });
  }

  useRunnerShortcuts({
    containerRef: cardRef,
    onPrimaryAction: () => {
      if (reviewIndex !== null) return;
      // Sau khi đúng — hoặc sau khi sai và đã xem đáp án — Enter sang câu tiếp.
      if (state.phase === "correct" || state.phase === "incorrect") handleContinue();
      else void handleSubmit(); // guards handle checking/empty
    },
  });

  // On every question change, drop the caret into the FIRST answer field so
  // fill-in questions are immediately typeable after "Tiếp tục" — no manual
  // click or Ctrl+→ needed. MCQ questions have no `[data-answer-field]`, so
  // this is a no-op for them. Keyed on the question id: QuestionCard remounts
  // per question, so the field exists by the time this effect runs.
  useEffect(() => {
    const field = cardRef.current?.querySelector<HTMLElement>("[data-answer-field]");
    if (field) field.focus();
    // MCQ (and other no-input kinds) have no answer field: drop any caret that
    // lingered in the previous question's input so no stray cursor shows.
    else (document.activeElement as HTMLElement | null)?.blur();
  }, [question?.id, redoTick]);

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

  if (reviewIndex !== null && past[reviewIndex]) {
    const entry = past[reviewIndex];
    return (
      <ReviewCard
        question={questions[entry.index]}
        past={entry}
        total={total}
        onPrev={reviewIndex > 0 ? () => setReviewIndex(reviewIndex - 1) : null}
        onNext={reviewIndex < past.length - 1 ? () => setReviewIndex(reviewIndex + 1) : null}
        onExit={() => setReviewIndex(null)}
      />
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
            key={`${question.id}:${redoTick}`}
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
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReviewIndex(past.length - 1)}
              disabled={past.length === 0}
            >
              ← Câu trước
            </Button>
            {isCorrect ? (
              <Button className="w-full sm:w-auto" onClick={handleContinue}>
                Tiếp tục
              </Button>
            ) : isIncorrect ? (
              // Đã hiện đáp án: tự làm lại câu này, hoặc bỏ qua sang câu sau.
              <div className="flex w-full gap-2 sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={handleRedoQuestion}>
                  Làm lại
                </Button>
                <Button className="flex-1 sm:flex-none" onClick={handleContinue}>
                  Tiếp tục
                </Button>
              </div>
            ) : (
              <Button
                className="w-full sm:w-auto"
                onClick={handleSubmit}
                disabled={isChecking || state.input.trim() === ""}
              >
                Kiểm tra
              </Button>
            )}
          </div>
        </div>

        {isIncorrect && (
          <div className="flex flex-col gap-3">
            {state.result?.reason ? (
              // A near-miss (missing capital / final period): show the precise
              // fix without revealing the full answer, so the learner corrects
              // it themselves.
              <div className="rounded-xl border border-streak-foreground/30 bg-streak-bg p-4">
                <p className="text-sm font-medium text-streak-foreground">{state.result.reason}</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-destructive">Chưa đúng.</p>
                {state.result?.correctAnswer && (
                  <div className="rounded-xl border border-success/30 bg-success-bg p-4">
                    <p className="text-sm text-muted-foreground">
                      Đáp án:{" "}
                      <span className="font-medium text-success">{state.result.correctAnswer}</span>
                    </p>
                  </div>
                )}
                {state.result?.keyNote && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive-bg p-4">
                    <p className="mb-1 text-caption font-bold text-destructive">💡 Ghi nhớ</p>
                    <p className="text-sm leading-relaxed">{state.result.keyNote}</p>
                  </div>
                )}
                <ExplanationSlot explanation={state.result?.explanation ?? null} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
