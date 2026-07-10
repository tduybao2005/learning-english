"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ListeningRunner, type SafeListeningSection } from "@/components/ListeningRunner";
import { transcriptChunksForSections } from "@/lib/transcript";

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

function LockedNote({ label }: { label: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-3.5 shrink-0" />
      {label}
    </p>
  );
}

/**
 * Client-side glue for `/listening/[slug]`: sticky AudioPlayer above the
 * sectioned runner. Transcript unlock is per completed section when the
 * transcript splits cleanly on "NARRATOR: Section N." markers
 * (transcriptChunksForSections); otherwise (legacy/TOEIC "Part N" content)
 * it falls back to the previous all-questions gate.
 */
export function ListeningSetView({
  slug,
  audioUrl,
  transcriptMd,
  sections,
}: {
  slug: string;
  audioUrl: string;
  transcriptMd: string;
  sections: SafeListeningSection[];
}) {
  const [sectionsDone, setSectionsDone] = useState(0);
  const chunks = useMemo(
    () => transcriptChunksForSections(transcriptMd, sections.length),
    [transcriptMd, sections.length],
  );
  const allDone = sectionsDone >= sections.length;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <AudioPlayer src={audioUrl} variant="full" />

        <ListeningRunner
          slug={slug}
          sections={sections}
          onSectionComplete={(i) => setSectionsDone((c) => Math.max(c, i + 1))}
          onFinished={() => setSectionsDone(sections.length)}
        />

        {/* Mobile: accordion(s) below the runner */}
        {chunks ? (
          <div className="flex flex-col gap-3 lg:hidden">
            {chunks.map((chunk, i) => {
              const unlocked = sectionsDone > i;
              return (
                <details key={i} className="group rounded-xl border border-border bg-card">
                  <summary
                    onClick={(e) => {
                      if (!unlocked) e.preventDefault();
                    }}
                    className={cn(
                      "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-semibold [&::-webkit-details-marker]:hidden",
                      unlocked ? "hover:bg-muted/50" : "cursor-not-allowed text-muted-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {!unlocked && <Lock className="size-3.5" />}
                      <span>Lời thoại — Phần {i + 1}</span>
                      {!unlocked && (
                        <span className="font-normal text-muted-foreground">
                          (hoàn thành Phần {i + 1} để mở khóa)
                        </span>
                      )}
                    </span>
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  {unlocked && (
                    <div className="border-t border-border px-4 py-4">
                      <TranscriptBody transcriptMd={chunk} />
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        ) : (
          <details className="group rounded-xl border border-border bg-card lg:hidden">
            <summary
              onClick={(e) => {
                if (!allDone) e.preventDefault();
              }}
              className={cn(
                "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-semibold [&::-webkit-details-marker]:hidden",
                allDone ? "hover:bg-muted/50" : "cursor-not-allowed text-muted-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                {!allDone && <Lock className="size-3.5" />}
                <span>Xem lời thoại</span>
                {!allDone && (
                  <span className="font-normal text-muted-foreground">(hoàn thành câu hỏi để mở khóa)</span>
                )}
              </span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            {allDone && (
              <div className="border-t border-border px-4 py-4">
                <TranscriptBody transcriptMd={transcriptMd} />
              </div>
            )}
          </details>
        )}
      </div>

      {/* Desktop: sticky aside */}
      <aside className="sticky top-8 hidden max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 lg:block">
        <p className="mb-3 text-caption font-bold tracking-wide text-muted-foreground">📄 LỜI THOẠI</p>
        {chunks ? (
          <div className="flex flex-col gap-4">
            {chunks.map((chunk, i) =>
              sectionsDone > i ? (
                <div key={i}>
                  <p className="mb-1 text-caption font-bold text-muted-foreground">Phần {i + 1}</p>
                  <TranscriptBody transcriptMd={chunk} />
                </div>
              ) : (
                <LockedNote key={i} label={`Phần ${i + 1}: hoàn thành để mở khóa.`} />
              ),
            )}
          </div>
        ) : allDone ? (
          <TranscriptBody transcriptMd={transcriptMd} />
        ) : (
          <LockedNote label="Hoàn thành câu hỏi để mở khóa lời thoại." />
        )}
      </aside>
    </div>
  );
}
