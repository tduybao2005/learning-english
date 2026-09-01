"use client";

import { useCallback, useEffect, useRef, useState } from "react";


import { playSfx } from "@/lib/audio/sfx";
import { playWordAudio, stopWordAudio } from "@/lib/audio/word-audio";
import { MatchBoard } from "@/components/vocab/MatchBoard";
import { QuizCard } from "@/components/vocab/QuizCard";
import { SessionSummary } from "@/components/vocab/SessionSummary";
import {
  buildMatchRound,
  buildQuizRound,
  eligibleForGames,
  type MatchRound,
  type QuizRound,
  type VocabWordLite,
} from "@/components/vocab/games";
import {
  createSession,
  peekStep,
  sessionResults,
  sessionStats,
  submitStep,
  type PlanStep,
  type SessionState,
} from "@/components/vocab/session-engine";

/** Nhịp chờ sau khi lộ đáp án rồi mới sang bước kế. */
const AUTO_ADVANCE_MS = 900;
/** Dưới ngần này từ thì không đủ để dựng đáp án nhiễu lẫn bàn ghép cặp. */
const MIN_WORDS = 4;

type Rendered =
  | { kind: "match"; step: PlanStep; round: MatchRound }
  | { kind: "quiz"; step: PlanStep; round: QuizRound; word: VocabWordLite | undefined };

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Một phiên luyện tập từ vựng: gộp ghép cặp và trắc nghiệm làm một.
 *
 * Mỗi chặng phát một bàn ghép cặp rồi tới các câu trắc nghiệm của chính
 * những từ vừa ghép; từ nào sai sẽ được `session-engine` hẹn hỏi lại xen vào
 * giữa, và phiên kéo dài cho tới khi từ đó được trả lời đúng đủ số lần. Vì
 * vậy tổng số câu KHÔNG cố định — thanh tiến độ đếm theo số từ đã xong chứ
 * không theo số câu.
 *
 * Cả `session` lẫn vòng chơi hiện tại đều dựng trong `useEffect` chứ không
 * phải lazy initializer của `useState`: component này vẫn được server render
 * một lần cho HTML đầu, mà `buildQuizRound`/`buildMatchRound` xáo bằng
 * `Math.random` nên hai lượt render ra kết quả khác nhau — đúng lỗi hydration
 * #418 từng gặp ở QuizGame/MatchGame trước đây.
 */
export function PracticeSession({
  words,
  backHref,
  linkComponent: Link,
}: {
  words: VocabWordLite[];
  backHref: string;
  /** Truyền `NextLink` trong app, `"a"` trong test/design. */
  linkComponent: React.ElementType;
}) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedForRef = useRef<SessionState | null>(null);

  const pool = eligibleForGames(words);
  const enoughWords = pool.length >= MIN_WORDS;

  const startSession = useCallback(() => {
    if (!enoughWords) return;
    setSession(createSession(pool.map((w) => w.id)));
    setSelectedId(null);
    setStreak(0);
    setBestStreak(0);
    setElapsed(0);
    setSaveState("idle");
    savedForRef.current = null;
    // `words` là prop cố định trong suốt một lần mount; danh sách id không đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enoughWords]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Dựng vòng chơi cho bước hiện tại. Chạy lại mỗi khi `session` đổi, tức là
  // đúng một lần cho mỗi bước — không dựng lại giữa chừng khi người học bấm.
  useEffect(() => {
    if (session === null) return;
    const step = peekStep(session);
    if (step === null) {
      setRendered(null);
      return;
    }

    if (step.kind === "match") {
      const stageWords = pool.filter((w) => step.wordIds.includes(w.id));
      const round = buildMatchRound(stageWords);
      if (round === null) {
        setSession((s) => (s === null ? s : submitStep(s, [])));
        return;
      }
      setRendered({ kind: "match", step, round });
      return;
    }

    const word = pool.find((w) => w.id === step.wordId);
    const round = word ? buildQuizRound(word, pool, 4) : null;
    if (round === null) {
      setSession((s) => (s === null ? s : submitStep(s, [])));
      return;
    }
    setRendered({ kind: "quiz", step, round, word });
    setSelectedId(null);
    // `pool` được tính lại mỗi lần render nhưng nội dung không đổi trong một
    // lần mount; đưa vào deps sẽ dựng lại vòng chơi ở mọi render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const finished = session !== null && session.stepCount > 0 && peekStep(session) === null;

  // Đồng hồ: chạy tới khi phiên kết thúc.
  useEffect(() => {
    if (session === null || finished) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [session, finished]);

  // Gửi kết quả đúng một lần cho mỗi phiên đã hoàn tất.
  useEffect(() => {
    if (!finished || session === null || savedForRef.current === session) return;
    savedForRef.current = session;
    const results = sessionResults(session);
    setSaveState("saving");
    void (async () => {
      try {
        const res = await fetch("/api/vocab/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ results }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    })();
  }, [finished, session]);

  // Tự sang bước kế sau khi đã lộ đáp án của câu trắc nghiệm.
  useEffect(() => {
    if (selectedId === null || rendered?.kind !== "quiz") return;
    const wrong = selectedId === rendered.round.correctOptionId ? [] : [rendered.round.wordId];
    const id = setTimeout(() => {
      setSelectedId(null);
      setSession((s) => (s === null ? s : submitStep(s, wrong)));
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [selectedId, rendered]);

  if (!enoughWords) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Chủ đề này chưa đủ từ vựng để luyện tập.
      </p>
    );
  }

  if (session === null || (!finished && rendered === null)) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Đang chuẩn bị phiên luyện tập...
      </p>
    );
  }

  if (finished) {
    const results = sessionResults(session);
    const correct = results.filter((r) => r.correct).length;
    return (
      <SessionSummary
        title="Hoàn thành phiên luyện tập!"
        correct={correct}
        total={results.length}
        extraStats={[
          { label: "Thời gian", value: formatTime(elapsed) },
          { label: "Chuỗi đúng dài nhất", value: String(bestStreak) },
          { label: "Từ phải ôn lại", value: String(session.wrongOnce.length) },
        ]}
        saveState={saveState}
        restartLabel="Luyện lại"
        onRestart={startSession}
        backHref={backHref}
        linkComponent={Link}
      />
    );
  }

  const view = rendered as Rendered;
  const stats = sessionStats(session);
  const percent = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
  const isReview = view.step.kind === "quiz" && view.step.review;

  function handleSelect(optionId: string) {
    if (selectedId !== null || rendered?.kind !== "quiz") return;
    setSelectedId(optionId);
    const correct = optionId === rendered.round.correctOptionId;
    // Phát ngay trong handler của cú bấm: Safari/iOS chỉ cho phát audio khi
    // còn trong ngữ cảnh user gesture.
    //
    // Đúng thì đọc chính từ tiếng Anh thay vì kêu "ting": phản hồi đó vừa
    // xác nhận vừa dạy cách đọc. Sai thì vẫn giữ tiếng báo lỗi — nó là cảnh
    // báo, và đọc từ ngay lúc vừa chọn sai sẽ nghe như đang khen.
    if (correct) {
      playWordAudio(rendered.word?.audioUrl ?? null);
    } else {
      stopWordAudio();
      playSfx("wrong");
    }
    const next = correct ? streak + 1 : 0;
    setStreak(next);
    setBestStreak((b) => Math.max(b, next));
  }

  function handleMatchComplete(wrongWordIds: string[]) {
    // Ghép nhầm cũng là trả lời sai, nên phải cắt chuỗi: nếu không, một
    // phiên 18/20 vẫn khoe "chuỗi đúng dài nhất 22" vì hai từ hỏng đều hỏng
    // ở bàn ghép cặp — con số đó tự mâu thuẫn với chính điểm bên cạnh.
    if (wrongWordIds.length > 0) setStreak(0);
    setSession((s) => (s === null ? s : submitStep(s, wrongWordIds)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span data-testid="stage-counter" className="font-semibold">
              Chặng {view.step.stageIndex + 1}/{session.stages.length}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">
              {view.kind === "match" ? "🧩 Ghép cặp" : "⚡ Trắc nghiệm"}
            </span>
            {stats.pendingReview > 0 && (
              <span
                data-testid="review-chip"
                className="rounded-full bg-streak-bg px-2.5 py-1 font-bold text-streak-foreground"
              >
                🔁 Ôn lại: {stats.pendingReview} từ
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            {(streak === 5 || streak === 10) && (
              <span
                data-testid="streak-milestone"
                className="animate-unlock-pop rounded-full bg-accent px-2.5 py-1 font-bold text-accent-foreground"
              >
                {streak === 10 ? "Bùng nổ! 10 câu liền" : "Chuỗi 5 câu!"}
              </span>
            )}
            <span data-testid="session-progress" className="font-mono">
              {stats.done}/{stats.total} từ · ⏱ {formatTime(elapsed)}
            </span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {view.kind === "match" ? (
        <MatchBoard round={view.round} onComplete={handleMatchComplete} />
      ) : (
        <div>
          {isReview && (
            <p
              data-testid="review-banner"
              className="mb-3 rounded-xl bg-streak-bg px-3 py-2 text-center text-caption font-semibold text-streak-foreground"
            >
              🔁 Ôn lại từ đã sai
            </p>
          )}
          <QuizCard
            round={view.round}
            word={view.word}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
}
