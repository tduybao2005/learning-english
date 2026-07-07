"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ListeningRunner } from "@/components/ListeningRunner";
import type { SafeQuestion } from "@/components/runner/QuestionCard";

const TRANSCRIPT_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;

const SPEAKER_PALETTE = ["text-primary", "text-accent"];

function TranscriptBody({ transcriptMd }: { transcriptMd: string }) {
  const lines = transcriptMd.split("\n").filter((l) => l.trim().length > 0);
  const speakerColor = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(TRANSCRIPT_LINE_RE);
    if (m && !speakerColor.has(m[1])) {
      speakerColor.set(m[1], SPEAKER_PALETTE[speakerColor.size % SPEAKER_PALETTE.length]);
    }
  }
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const m = line.match(TRANSCRIPT_LINE_RE);
        if (!m) return <p key={i}>{line}</p>;
        return (
          <p key={i}>
            <span className={cn("font-semibold", speakerColor.get(m[1]) ?? "text-foreground")}>
              {m[1]}:
            </span>{" "}
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
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <AudioPlayer src={audioUrl} variant="full" />

        <ListeningRunner slug={slug} questions={questions} onFinished={() => setCompleted(true)} />

        <details className="rounded-xl border border-border bg-card lg:hidden" open={completed && transcriptOpen}>
          <summary
            onClick={(e) => {
              e.preventDefault();
              if (completed) setTranscriptOpen((open) => !open);
            }}
            aria-expanded={transcriptOpen}
            className={cn(
              "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-semibold [&::-webkit-details-marker]:hidden",
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
          </summary>
          {completed && transcriptOpen && (
            <div className="border-t border-border px-4 py-4">
              <TranscriptBody transcriptMd={transcriptMd} />
            </div>
          )}
        </details>
      </div>

      <aside className="sticky top-8 hidden max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 lg:block">
        <p className="mb-3 text-caption font-bold tracking-wide text-muted-foreground">📄 LỜI THOẠI</p>
        {completed ? (
          <TranscriptBody transcriptMd={transcriptMd} />
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            Hoàn thành câu hỏi để mở khóa transcript.
          </p>
        )}
      </aside>
    </div>
  );
}
