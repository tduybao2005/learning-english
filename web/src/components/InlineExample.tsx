"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SafeExample } from "@/lib/lecture-examples";

type Status = "idle" | "checking" | "correct" | "incorrect" | "revealed";

const BLANK_RE = /_{3,}/; // same blank convention as runner/QuestionCard

/** Renders the prompt with its ___ blank drawn as a dashed gap. */
function Prompt({ prompt }: { prompt: string }) {
  const parts = prompt.split(BLANK_RE);
  if (parts.length === 1) {
    return <p className="mb-3 leading-relaxed">{prompt}</p>;
  }
  return (
    <p className="mb-3 leading-relaxed">
      {parts[0]}
      <span className="mx-1 inline-block min-w-16 border-b-2 border-dashed border-primary/50 align-baseline" />
      {parts.slice(1).join(" ___ ")}
    </p>
  );
}

/**
 * One interactive example embedded in a lecture. Checking and revealing both
 * go through the server (`/api/lessons/:id/example-check`) — the answer is
 * never shipped with the page. Nothing is persisted: the card resets on
 * reload, by design, since these are practice aids and not graded work.
 */
export function InlineExample({
  lessonId,
  example,
}: {
  lessonId: string;
  example: SafeExample;
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [hintShown, setHintShown] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const done = status === "correct" || status === "revealed";
  const busy = status === "checking";

  async function post(body: { exampleId: string; input: string; reveal?: boolean }) {
    const res = await fetch(`/api/lessons/${lessonId}/example-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("request_failed");
    return res.json();
  }

  async function handleCheck() {
    if (done || busy || input.trim().length === 0) return;
    setStatus("checking");
    try {
      const data = await post({ exampleId: example.id, input });
      if (data.correct) {
        setAnswer(typeof data.answer === "string" ? data.answer : null);
        setStatus("correct");
      } else {
        setStatus("incorrect");
      }
    } catch {
      setStatus("idle");
    }
  }

  async function handleReveal() {
    if (done || busy) return;
    setStatus("checking");
    try {
      const data = await post({ exampleId: example.id, input: "", reveal: true });
      setAnswer(typeof data.answer === "string" ? data.answer : null);
      setStatus("revealed");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div
      className={cn(
        "my-6 rounded-xl border border-border bg-muted/30 p-4",
        status === "correct" && "border-success/50 bg-success-bg/40",
        status === "revealed" && "border-primary/40",
      )}
    >
      <p className="mb-2 text-caption font-semibold text-muted-foreground">✏️ Thử ngay</p>
      <Prompt prompt={example.prompt} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (status === "incorrect") setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCheck();
          }}
          disabled={done || busy}
          aria-invalid={status === "incorrect" || undefined}
          aria-label="Câu trả lời"
          placeholder="Điền câu trả lời…"
          className="sm:max-w-60"
        />
        <div className="flex flex-wrap gap-2">
          {!done && (
            <Button size="sm" onClick={handleCheck} disabled={busy || input.trim() === ""}>
              {status === "incorrect" ? "Thử lại" : "Kiểm tra"}
            </Button>
          )}
          {!hintShown && !done && (
            <Button size="sm" variant="outline" onClick={() => setHintShown(true)} disabled={busy}>
              Gợi ý
            </Button>
          )}
          {!done && (
            <Button size="sm" variant="ghost" onClick={handleReveal} disabled={busy}>
              Xem đáp án
            </Button>
          )}
        </div>
      </div>

      {hintShown && !done && (
        <p className="mt-3 text-sm text-muted-foreground">💡 {example.hint}</p>
      )}
      {status === "incorrect" && (
        <p className="mt-3 text-sm font-medium text-destructive">Chưa đúng. Hãy thử lại!</p>
      )}
      {status === "correct" && (
        <p className="mt-3 text-sm font-medium text-success">
          Chính xác!{answer ? ` Đáp án: ${answer}` : ""}
        </p>
      )}
      {status === "revealed" && answer && (
        <p className="mt-3 text-sm font-medium text-foreground">
          Đáp án: <span className="text-primary">{answer}</span>
        </p>
      )}
    </div>
  );
}
