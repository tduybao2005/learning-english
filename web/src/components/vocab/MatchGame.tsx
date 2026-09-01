"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { SessionSummary } from "@/components/vocab/SessionSummary";
import { buildMatchRounds, type VocabWordLite, type MatchRound } from "@/components/vocab/games";

interface ReviewResult {
  wordId: string;
  correct: boolean;
}

const WRONG_FLASH_MS = 500;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Tap-to-pair word/meaning matching game: rounds of up to 6 EN/VI pairs in
 * two independently-shuffled columns. Tap a left tile then a right tile (or
 * either order) — a correct pair locks in, a wrong pair shakes red briefly
 * then clears the selection. A running timer records the session time; the
 * best time is kept in `localStorage` per lesson.
 *
 * Only a *successful* match ever produces a review result (`correct: true`)
 * — a wrong attempt is just a mismatched guess, not a graded review of
 * either word, so it's never sent to `/api/vocab/review`. Combined with
 * `buildMatchRounds` sampling without replacement, every wordId appears at
 * most once in the whole session's results, so there is no duplicate-wordId
 * batching concern for this game either (see `games.ts`).
 *
 * `rounds` starts `null` and is computed in a `useEffect` (Task 15 fix), NOT
 * a `useState` lazy initializer — see `QuizGame`'s docstring for why: this
 * component is still server-rendered once for the initial HTML, and
 * `buildMatchRounds`'s default `Math.random` rng shuffles differently on
 * that server pass vs. the client hydration pass, which produced a real
 * React hydration error (#418) caught during this task's E2E smoke test.
 */
export function MatchGame({
  words,
  backHref,
  lessonId,
  linkComponent: Link,
}: {
  words: VocabWordLite[];
  backHref: string;
  lessonId: string;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
  const [rounds, setRounds] = useState<MatchRound[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `totalRounds` (not `round`/`allDone`) is needed by the timer effect's
  // dependency array below, so it's computed here, ahead of the
  // rounds-not-ready-yet early return — 0 while `rounds` is still null,
  // which correctly keeps the timer from starting until real rounds exist.
  const totalRounds = rounds?.length ?? 0;
  const storageKey = `vocab-match-best:${lessonId}`;

  // Compute the shuffled rounds client-side only, post-mount — see the
  // docstring above for why this can't be a `useState` lazy initializer.
  useEffect(() => {
    setRounds(buildMatchRounds(words, 6));
    // `words` is a stable prop per mount; this should run exactly once, not reshuffle mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the previous best time client-side only, after mount — reading
  // localStorage during render would desync server/client HTML.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null && !Number.isNaN(Number(raw))) setBestTime(Number(raw));
    } catch {
      // localStorage unavailable (e.g. private browsing) — best time just won't persist.
    }
  }, [storageKey]);

  // Timer: ticks once per second until the whole session is finished.
  useEffect(() => {
    if (finished || totalRounds === 0) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [finished, totalRounds]);

  useEffect(() => {
    return () => {
      if (wrongTimeoutRef.current) clearTimeout(wrongTimeoutRef.current);
    };
  }, []);

  if (rounds === null) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Đang chuẩn bị trò chơi...
      </p>
    );
  }

  const round = rounds[roundIndex];
  const allDone = roundIndex >= totalRounds;

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

  function finishSession(finalResults: ReviewResult[], finalElapsed: number) {
    setFinished(true);
    try {
      if (bestTime === null || finalElapsed < bestTime) {
        window.localStorage.setItem(storageKey, String(finalElapsed));
        setBestTime(finalElapsed);
      }
    } catch {
      // ignore — best time is a nice-to-have, not required for correctness.
    }
    void submitResults(finalResults);
  }

  function evaluate(leftId: string, rightId: string) {
    if (leftId === rightId) {
      const nextMatched = new Set(matched);
      nextMatched.add(leftId);
      setMatched(nextMatched);
      setSelectedLeft(null);
      setSelectedRight(null);

      const nextResults = [...results, { wordId: leftId, correct: true }];
      setResults(nextResults);

      if (round && nextMatched.size >= round.pairs.length) {
        const nextRoundIndex = roundIndex + 1;
        setRoundIndex(nextRoundIndex);
        if (nextRoundIndex >= totalRounds) {
          finishSession(nextResults, elapsed);
        } else {
          setMatched(new Set());
        }
      }
    } else {
      setWrongPair({ left: leftId, right: rightId });
      wrongTimeoutRef.current = setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, WRONG_FLASH_MS);
    }
  }

  function handleClickLeft(id: string) {
    if (matched.has(id) || wrongPair) return;
    if (selectedLeft === id) {
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft(id);
    if (selectedRight !== null) evaluate(id, selectedRight);
  }

  function handleClickRight(id: string) {
    if (matched.has(id) || wrongPair) return;
    if (selectedRight === id) {
      setSelectedRight(null);
      return;
    }
    setSelectedRight(id);
    if (selectedLeft !== null) evaluate(selectedLeft, id);
  }

  function handleRestart() {
    setRoundIndex(0);
    setMatched(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPair(null);
    setResults([]);
    setElapsed(0);
    setFinished(false);
    setSaveState("idle");
  }

  if (totalRounds === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Bài học này chưa đủ từ vựng để chơi nối từ.
      </p>
    );
  }

  const bestTimeLabel = bestTime !== null ? formatTime(bestTime) : null;

  if (allDone) {
    const totalPairs = rounds.reduce((sum, r) => sum + r.pairs.length, 0);
    return (
      <SessionSummary
        title="Hoàn thành nối từ!"
        correct={results.length}
        total={totalPairs}
        extraStats={[
          { label: "Thời gian", value: formatTime(elapsed) },
          ...(bestTimeLabel !== null ? [{ label: "Kỷ lục", value: bestTimeLabel }] : []),
        ]}
        saveState={saveState}
        restartLabel="Chơi lại"
        onRestart={handleRestart}
        backHref={backHref}
        linkComponent={Link}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Vòng {roundIndex + 1}/{totalRounds}
        </span>
        <span className="font-mono text-caption">
          ⏱ {formatTime(elapsed)}
          {bestTimeLabel !== null && <> · Kỷ lục {bestTimeLabel}</>}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {round.left.map((pair) => {
            const isMatched = matched.has(pair.wordId);
            const isSelected = selectedLeft === pair.wordId;
            const isWrong = wrongPair?.left === pair.wordId;
            return (
              <button
                key={pair.wordId}
                type="button"
                disabled={isMatched}
                onClick={() => handleClickLeft(pair.wordId)}
                className={cn(
                  "rounded-lg border-2 p-3 text-left font-medium transition-colors",
                  isMatched && "animate-pop border-success/40 bg-success-bg text-success opacity-40",
                  !isMatched && isWrong && "animate-shake border-destructive bg-destructive-bg text-destructive",
                  !isMatched && !isWrong && isSelected && "border-primary bg-primary/10",
                  !isMatched && !isWrong && !isSelected && "border-border bg-card hover:border-primary/40",
                )}
              >
                {pair.word}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {round.right.map((pair) => {
            const isMatched = matched.has(pair.wordId);
            const isSelected = selectedRight === pair.wordId;
            const isWrong = wrongPair?.right === pair.wordId;
            return (
              <button
                key={pair.wordId}
                type="button"
                disabled={isMatched}
                onClick={() => handleClickRight(pair.wordId)}
                className={cn(
                  "rounded-lg border-2 p-3 text-left font-medium transition-colors",
                  isMatched && "animate-pop border-success/40 bg-success-bg text-success opacity-40",
                  !isMatched && isWrong && "animate-shake border-destructive bg-destructive-bg text-destructive",
                  !isMatched && !isWrong && isSelected && "border-primary bg-primary/10",
                  !isMatched && !isWrong && !isSelected && "border-border bg-card hover:border-primary/40",
                )}
              >
                {pair.meaningVi}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
