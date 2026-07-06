"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildQuizRounds, type VocabWordLite, type QuizRound } from "@/components/vocab/games";

interface ReviewResult {
  wordId: string;
  correct: boolean;
}

/**
 * A 10-round (or fewer, on a small lesson) multiple-choice quiz: random
 * EN→VI or VI→EN direction per round, 4 options (fewer on a small lesson),
 * instant right/wrong color feedback, running streak counter. Results
 * accumulate client-side and are batch-POSTed to `/api/vocab/review` once
 * at the end — same pattern as `Flashcards.tsx` — and, because
 * `buildQuizRounds` samples without replacement, no wordId can appear
 * twice in one session's results.
 *
 * `rounds` starts `null` and is computed in a `useEffect` (Task 15 fix),
 * NOT a `useState` lazy initializer — this component is still rendered
 * once on the server (Next.js SSRs "use client" components for the initial
 * HTML too), and `buildQuizRounds`'s default `rng` is `Math.random`, which
 * produces a different shuffle on the server pass than on the client's
 * hydration pass. That mismatch triggered a real React hydration error
 * (#418) caught during this task's E2E smoke test. Deferring the shuffle to
 * an effect means both the server render and the client's first render
 * produce the same "loading" output; the real (random) rounds are only
 * ever computed client-side, after hydration has already reconciled.
 */
export function QuizGame({ words, backHref }: { words: VocabWordLite[]; backHref: string }) {
  const [rounds, setRounds] = useState<QuizRound[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setRounds(buildQuizRounds(words, 10, 4));
    // `words` is a stable prop per mount; this should run exactly once, not reshuffle on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rounds === null) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Đang chuẩn bị câu hỏi...
      </p>
    );
  }

  const total = rounds.length;
  const done = index >= total;
  const round = rounds[index];
  const answered = selectedId !== null;

  async function submitResults(finalResults: ReviewResult[]) {
    setSaveState("saving");
    try {
      const res = await fetch("/api/vocab/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ results: finalResults }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  function handleSelect(optionId: string) {
    if (answered) return;
    setSelectedId(optionId);
    const correct = optionId === round.correctOptionId;
    const nextStreak = correct ? streak + 1 : 0;
    setStreak(nextStreak);
    setBestStreak((b) => Math.max(b, nextStreak));

    const next = [...results, { wordId: round.wordId, correct }];
    setResults(next);
  }

  function handleNext() {
    setSelectedId(null);
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= total) {
      void submitResults(results);
    }
  }

  function handleRestart() {
    setIndex(0);
    setSelectedId(null);
    setResults([]);
    setStreak(0);
    setBestStreak(0);
    setSaveState("idle");
  }

  if (total === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Bài học này chưa đủ từ vựng để chơi trắc nghiệm.
      </p>
    );
  }

  if (done) {
    const correctCount = results.filter((r) => r.correct).length;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <div className="text-5xl">🏆</div>
        <h2 className="text-xl font-bold">Hoàn thành trắc nghiệm!</h2>
        <p className="text-muted-foreground">
          Đúng{" "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{correctCount}</span>{" "}
          / {total} câu · Chuỗi đúng dài nhất{" "}
          <span className="font-medium text-primary">{bestStreak}</span>
        </p>
        {saveState === "saving" && (
          <p className="text-xs text-muted-foreground">Đang lưu tiến độ...</p>
        )}
        {saveState === "saved" && <p className="text-xs text-muted-foreground">Đã lưu tiến độ.</p>}
        {saveState === "error" && (
          <p className="text-xs text-destructive">
            Không thể lưu tiến độ. Vui lòng kiểm tra kết nối và thử lại.
          </p>
        )}
        <div className="mt-3 flex gap-3">
          <Button variant="outline" onClick={handleRestart}>
            Chơi lại
          </Button>
          <Link href={backHref} className={cn(buttonVariants())}>
            Quay lại từ vựng
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Câu {index + 1}/{total}
          </span>
          <span className="rounded-full bg-streak-bg px-2.5 py-1 text-caption font-bold text-streak-foreground">
            <span className={streak >= 2 ? "inline-block animate-flame" : "inline-block"}>🔥</span>{" "}
            Chuỗi đúng: {streak}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="mb-1 text-xs text-muted-foreground">
          {round.direction === "EN_TO_VI" ? "Nghĩa tiếng Việt của từ này là gì?" : "Từ tiếng Anh nào có nghĩa này?"}
        </p>
        <p className="text-2xl font-bold">{round.prompt}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="quiz-options">
        {round.options.map((option, i) => {
          const label = String.fromCharCode(65 + i);
          const isCorrect = option.id === round.correctOptionId;
          const isSelected = option.id === selectedId;
          const isCorrectPick = isSelected && answered && isCorrect;
          const isWrong = isSelected && answered && !isCorrect;
          // The quiz is one-shot (no retry): when the learner picks wrong, reveal
          // which option WAS correct so they still learn the answer — unlike the
          // exercise runner (Task 8), where a wrong pick just invites a retry and
          // the correct option is deliberately never shown.
          const isCorrectReveal = answered && isCorrect && !isSelected;

          return (
            <button
              key={option.id}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(option.id)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors disabled:opacity-70",
                isSelected && !isWrong && !isCorrectPick && "border-primary bg-primary/10",
                !isSelected && !isCorrectReveal && "border-border hover:bg-muted",
                isWrong && "animate-shake border-destructive bg-destructive-bg",
                (isCorrectPick || isCorrectReveal) && "border-success bg-success-bg",
                isCorrectPick && "animate-pop",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  isWrong && "bg-destructive/15 text-destructive",
                  (isCorrectPick || isCorrectReveal) && "bg-success text-success-foreground",
                  isSelected && !isWrong && !isCorrectPick && "bg-primary text-primary-foreground",
                  !isSelected && !isCorrectReveal && "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </span>
              <span>{option.text}</span>
              {isWrong && <span className="ml-auto text-destructive">✕</span>}
              {(isCorrectPick || isCorrectReveal) && <span className="ml-auto text-success">✓</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex justify-center">
          <Button onClick={handleNext}>{index + 1 >= total ? "Xem kết quả" : "Câu tiếp theo →"}</Button>
        </div>
      )}
    </div>
  );
}
