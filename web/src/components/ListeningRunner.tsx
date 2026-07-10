"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initRunnerState, runnerReducer } from "@/components/runner/reducer";
import { QuestionCard, type SafeQuestion } from "@/components/runner/QuestionCard";
import { ExplanationSlot } from "@/components/runner/ExplanationSlot";
import {
  completedSectionCount,
  questionIndexInSection,
  sectionIndexForQuestion,
  sectionStartIndexes,
} from "@/components/runner/sections";

export interface SafeListeningSection {
  label: string;
  title: string;
  instructions: string | null;
  questions: SafeQuestion[];
}

/**
 * Question-answering flow for a listening set, rendered as "Phần 1..N"
 * sections over the same flat forward-only reducer as before (reducer and
 * the stateless POST /api/listening/[slug]/check are untouched). The section
 * stepper is display-only: free section jumping would break the
 * retry-until-correct completion invariant that gates transcript unlock.
 * `onSectionComplete(i)` fires once per section, in order, so the parent can
 * unlock that section's transcript chunk.
 */
export function ListeningRunner({
  slug,
  sections,
  onSectionComplete,
  onFinished,
}: {
  slug: string;
  sections: SafeListeningSection[];
  onSectionComplete?: (sectionIndex: number) => void;
  onFinished: () => void;
}) {
  const flat = useMemo(() => sections.flatMap((s) => s.questions), [sections]);
  const counts = useMemo(() => sections.map((s) => s.questions.length), [sections]);

  const [state, dispatch] = useReducer(runnerReducer, undefined, () =>
    initRunnerState(
      flat.map((q) => q.id),
      0,
    ),
  );

  // Strict-mode-safe: remembers how many sections were already reported.
  const reportedRef = useRef(0);
  useEffect(() => {
    const done = completedSectionCount(counts, state.index, state.phase === "finished");
    for (let s = reportedRef.current; s < done; s++) onSectionComplete?.(s);
    reportedRef.current = Math.max(reportedRef.current, done);
    if (state.phase === "finished") onFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on progress transitions, not callback identity changes
  }, [state.index, state.phase]);

  if (flat.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Bài nghe này chưa có câu hỏi.
      </p>
    );
  }

  const total = flat.length;
  const question = flat[state.index];

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
        <h2 className="text-lg font-bold">Hoàn thành cả {sections.length} phần!</h2>
        <p className="text-sm text-muted-foreground">Bây giờ bạn có thể xem toàn bộ lời thoại.</p>
      </div>
    );
  }

  if (!question) return null;

  const sIdx = sectionIndexForQuestion(counts, state.index);
  const qInSection = questionIndexInSection(counts, state.index);
  const section = sections[sIdx];
  const percent = Math.round((state.index / total) * 100);
  const isChecking = state.phase === "checking";
  const isIncorrect = state.phase === "incorrect";
  const isCorrect = state.phase === "correct";

  return (
    <div className="flex flex-col gap-4">
      <SectionStepper sections={sections} counts={counts} flatIndex={state.index} />

      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-caption font-bold tracking-wide text-primary">
          PHẦN {sIdx + 1}/{sections.length}
        </p>
        <p className="mt-0.5 font-semibold">{section.title}</p>
        {section.instructions && (
          <p className="mt-1 text-sm text-muted-foreground">{section.instructions}</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Phần {sIdx + 1} · Câu {qInSection + 1}/{counts[sIdx]}
          </span>
          <span className="flex items-center gap-3">
            {isIncorrect && <span>Lần thử: {state.tries}</span>}
            <span>
              Tổng: {state.index + 1}/{total}
            </span>
          </span>
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
            <p className="font-medium text-success">Chính xác!</p>
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

function SectionStepper({
  sections,
  counts,
  flatIndex,
}: {
  sections: SafeListeningSection[];
  counts: number[];
  flatIndex: number;
}) {
  const starts = sectionStartIndexes(counts);
  const current = sectionIndexForQuestion(counts, flatIndex);
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Tiến độ các phần">
      {sections.map((_, i) => {
        const answered = Math.min(Math.max(flatIndex - starts[i], 0), counts[i]);
        const done = answered >= counts[i];
        const isCurrent = i === current && !done;
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
            <span className={cn(!isCurrent && !done && "opacity-70")}>
              {done ? "✓" : `${answered}/${counts[i]}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
