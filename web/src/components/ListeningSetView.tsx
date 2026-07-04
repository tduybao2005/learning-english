"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ListeningRunner } from "@/components/ListeningRunner";
import type { SafeQuestion } from "@/components/runner/QuestionCard";

const TRANSCRIPT_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;

function TranscriptBody({ transcriptMd }: { transcriptMd: string }) {
  const lines = transcriptMd.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const m = line.match(TRANSCRIPT_LINE_RE);
        if (!m) return <p key={i}>{line}</p>;
        return (
          <p key={i}>
            <span className="font-semibold text-foreground">{m[1]}:</span>{" "}
            <span className="text-muted-foreground">{m[2]}</span>
          </p>
        );
      })}
    </div>
  );
}

/**
 * Client-side glue for `/listening/[slug]`: sticky `AudioPlayer` above the
 * question runner, with a "Xem transcript" accordion gated on the runner
 * reporting all questions answered correctly (`onFinished`). Kept as one
 * client component (rather than splitting player/runner/transcript state
 * across the server page) because the transcript-unlock condition depends on
 * client-only runner state.
 */
export function ListeningSetView({
  slug,
  audioUrl,
  transcriptMd,
  questions,
}: {
  slug: string;
  audioUrl: string;
  transcriptMd: string;
  questions: SafeQuestion[];
}) {
  const [completed, setCompleted] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <AudioPlayer src={audioUrl} />

      <ListeningRunner slug={slug} questions={questions} onFinished={() => setCompleted(true)} />

      <div className="rounded-xl border border-border bg-card">
        <button
          type="button"
          disabled={!completed}
          onClick={() => setTranscriptOpen((open) => !open)}
          aria-expanded={transcriptOpen}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium",
            completed ? "hover:bg-muted/50" : "cursor-not-allowed text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2">
            {!completed && <Lock className="size-3.5" />}
            <span>Xem transcript</span>
            {!completed && (
              <span className="font-normal text-muted-foreground">
                (hoàn thành câu hỏi để mở khóa)
              </span>
            )}
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", transcriptOpen && "rotate-180")}
          />
        </button>
        {completed && transcriptOpen && (
          <div className="border-t border-border px-4 py-4">
            <TranscriptBody transcriptMd={transcriptMd} />
          </div>
        )}
      </div>
    </div>
  );
}
