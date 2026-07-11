"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/runner/QuestionCard";
import { ExplanationSlot } from "@/components/runner/ExplanationSlot";
import type { AnswerResult } from "@/components/runner/reducer";
import {
  initSectionRunnerState,
  isSectionComplete,
  sectionReducer,
  type SafeListeningSection,
} from "@/components/runner/section-runner";

export type { SafeListeningSection };

interface SectionedListeningRunnerProps {
  slug: string;
  sections: SafeListeningSection[];
  onSectionChange?: (sectionIndex: number) => void;
  onSectionSubmitted?: (sectionIndex: number) => void;
  onReset?: () => void;
}

/**
 * Section-batched listening runner: shows ALL questions of the current
 * section at once, submits them together, reveals which were wrong + the
 * correct answers, then continues to the next section. Owns all state via
 * the `section-runner` reducer — not controlled by the parent. "Làm lại"
 * remounts the inner session (via `key`) for a clean reset, the same trick
 * `ExerciseRunner` uses.
 */
export function SectionedListeningRunner({
  slug,
  sections,
  onSectionChange,
  onSectionSubmitted,
  onReset,
}: SectionedListeningRunnerProps) {
  const [resetKey, setResetKey] = useState(0);

  function handleReset() {
    setResetKey((k) => k + 1);
    onReset?.();
  }

  return (
    <SectionedListeningRunnerSession
      key={resetKey}
      slug={slug}
      sections={sections}
      onSectionChange={onSectionChange}
      onSectionSubmitted={onSectionSubmitted}
      onReset={handleReset}
    />
  );
}

function SectionedListeningRunnerSession({
  slug,
  sections,
  onSectionChange,
  onSectionSubmitted,
  onReset,
}: {
  slug: string;
  sections: SafeListeningSection[];
  onSectionChange?: (sectionIndex: number) => void;
  onSectionSubmitted?: (sectionIndex: number) => void;
  onReset: () => void;
}) {
  const [state, dispatch] = useReducer(sectionReducer, undefined, initSectionRunnerState);

  // Strict-mode-safe: fires each callback exactly once per transition.
  const lastReportedSectionIndex = useRef<number | null>(null);
  const lastReportedSubmitted = useRef(-1);

  useEffect(() => {
    if (lastReportedSectionIndex.current !== state.sectionIndex) {
      lastReportedSectionIndex.current = state.sectionIndex;
      onSectionChange?.(state.sectionIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on index change, not callback identity changes
  }, [state.sectionIndex]);

  useEffect(() => {
    if (state.phase === "submitted" && lastReportedSubmitted.current < state.sectionIndex) {
      lastReportedSubmitted.current = state.sectionIndex;
      onSectionSubmitted?.(state.sectionIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on phase/index transitions, not callback identity changes
  }, [state.phase, state.sectionIndex]);

  if (sections.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Bài nghe này chưa có câu hỏi.
      </p>
    );
  }

  if (state.phase === "finished") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/50 bg-success-bg p-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="text-lg font-bold">Hoàn thành cả {sections.length} phần!</h2>
        <p className="text-sm text-muted-foreground">Bây giờ bạn có thể xem toàn bộ lời thoại.</p>
        <Button variant="outline" className="mt-2" onClick={onReset}>
          Làm lại
        </Button>
      </div>
    );
  }

  const section = sections[state.sectionIndex];
  const isChecking = state.phase === "checking";
  const isSubmitted = state.phase === "submitted";
  const results = state.results;

  async function handleSubmit() {
    if (state.phase !== "answering") return;
    if (!isSectionComplete(section, state.answers)) return;

    dispatch({ type: "SUBMIT_SECTION" });

    const entries = await Promise.all(
      section.questions.map(async (q) => {
        const res = await fetch(`/api/listening/${slug}/check`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questionId: q.id, answerText: state.answers[q.id] }),
        });
        const json = (await res.json()) as AnswerResult;
        return [q.id, json] as const;
      }),
    );

    const results: Record<string, AnswerResult> = {};
    for (const [id, result] of entries) results[id] = result;
    dispatch({ type: "SECTION_RESULT", results });
  }

  function handleContinue() {
    dispatch({ type: "CONTINUE", totalSections: sections.length });
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionStepper sections={sections} currentIndex={state.sectionIndex} />

      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-caption font-bold tracking-wide text-primary">
          PHẦN {state.sectionIndex + 1}/{sections.length}
        </p>
        <p className="mt-0.5 font-semibold">{section.title}</p>
        {section.instructions && (
          <p className="mt-1 text-sm text-muted-foreground">{section.instructions}</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {section.questions.map((q) => {
          const result = results?.[q.id];
          const status = isSubmitted ? (result?.correct ? "correct" : "incorrect") : "answering";
          const isWrong = isSubmitted && result && !result.correct;
          const isCorrect = isSubmitted && result?.correct;

          return (
            <div
              key={q.id}
              className={cn(
                "rounded-xl border p-5 transition-colors",
                isWrong && "border-destructive/50 bg-destructive/5",
                isCorrect && "border-success/50 bg-success-bg",
                !isWrong && !isCorrect && "border-border bg-card",
              )}
            >
              <QuestionCard
                question={q}
                disabled={isChecking || isSubmitted}
                status={status}
                onChangeInput={(value) => dispatch({ type: "SET_ANSWER", questionId: q.id, value })}
                emphasizePrompt={false}
              />

              {isWrong && (
                <div className="mt-3 text-sm">
                  <p className="font-medium text-destructive">Chưa đúng.</p>
                  {result?.correctAnswer && (
                    <p className="text-muted-foreground">
                      Đáp án: <span className="font-medium text-foreground">{result.correctAnswer}</span>
                    </p>
                  )}
                  {result?.keyNote && <p className="text-muted-foreground">{result.keyNote}</p>}
                  <ExplanationSlot explanation={result?.explanation ?? null} />
                </div>
              )}

              {isCorrect && (
                <div className="mt-3 text-sm">
                  <p className="font-medium text-success">Chính xác!</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        {isSubmitted ? (
          <Button onClick={handleContinue}>Tiếp tục</Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isChecking || !isSectionComplete(section, state.answers)}
          >
            Nộp phần
          </Button>
        )}
      </div>
    </div>
  );
}

function SectionStepper({
  sections,
  currentIndex,
}: {
  sections: SafeListeningSection[];
  currentIndex: number;
}) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Tiến độ các phần">
      {sections.map((_, i) => {
        const done = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li
            key={i}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              done && "bg-success-bg text-success",
              isCurrent && "bg-primary text-primary-foreground",
              !done && !isCurrent && "bg-muted text-muted-foreground",
            )}
          >
            <span>Phần {i + 1}</span>
            {done && <span>✓</span>}
          </li>
        );
      })}
    </ol>
  );
}
