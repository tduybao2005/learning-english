"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SectionedListeningRunner } from "@/components/SectionedListeningRunner";
import type { SafeListeningSection } from "@/components/runner/section-runner";
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
 * Client-side glue for `/listening/[slug]`. Tablet and up (`md:`): questions on
 * the left, a sticky right rail holding the AudioPlayer above the transcript
 * (280px rail at `md:`, 320px at `lg:`). Phones: player first, then questions,
 * then per-section transcript accordions — the player is one element, reordered
 * by `md:order-*`, never duplicated.
 * Transcript unlock is per completed section when the
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
  const [currentSection, setCurrentSection] = useState(0);
  const [sectionsUnlocked, setSectionsUnlocked] = useState<Set<number>>(() => new Set());
  const chunks = useMemo(
    () => transcriptChunksForSections(transcriptMd, sections.length),
    [transcriptMd, sections.length],
  );
  const allDone = sectionsUnlocked.size >= sections.length;
  const currentAudioUrl = sections[currentSection]?.audioUrl ?? audioUrl;

  function handleSectionSubmitted(sectionIndex: number) {
    setSectionsUnlocked((prev) => {
      const next = new Set(prev);
      next.add(sectionIndex);
      return next;
    });
  }

  function handleReset() {
    setCurrentSection(0);
    setSectionsUnlocked(new Set());
  }

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_280px] md:items-start md:gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      {/* Right rail from tablet up, but first in DOM order so phones — which have
          no right column — still get the player above the questions. */}
      <div className="flex flex-col gap-6 md:sticky md:top-8 md:order-2 md:max-h-[calc(100vh-4rem)]">
        <AudioPlayer src={currentAudioUrl} variant="full" />

        {/* Tablet/desktop: transcript under the player */}
        <aside className="hidden min-h-0 overflow-y-auto rounded-xl border border-border bg-card p-4 md:block">
          <p className="mb-3 text-caption font-bold tracking-wide text-muted-foreground">📄 LỜI THOẠI</p>
          {chunks ? (
            <div className="flex flex-col gap-4">
              {chunks.map((chunk, i) =>
                sectionsUnlocked.has(i) ? (
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

      <div className="flex min-w-0 flex-col gap-6 md:order-1">
        <SectionedListeningRunner
          slug={slug}
          sections={sections}
          onSectionChange={setCurrentSection}
          onSectionSubmitted={handleSectionSubmitted}
          onReset={handleReset}
        />

        {/* Phone: accordion(s) below the runner */}
        {chunks ? (
          <div className="flex flex-col gap-3 md:hidden">
            {chunks.map((chunk, i) => {
              const unlocked = sectionsUnlocked.has(i);
              return (
                <details key={i} className="group rounded-xl border border-border bg-card">
                  <summary
                    onClick={(e) => {
                      if (!unlocked) e.preventDefault();
                    }}
                    className={cn(
                      "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-semibold [&::-webkit-details-marker]:hidden",
                      unlocked ? "press-tile transition-all hover:bg-muted/50 active:bg-muted" : "cursor-not-allowed text-muted-foreground",
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
          <details className="group rounded-xl border border-border bg-card md:hidden">
            <summary
              onClick={(e) => {
                if (!allDone) e.preventDefault();
              }}
              className={cn(
                "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-semibold [&::-webkit-details-marker]:hidden",
                allDone ? "press-tile transition-all hover:bg-muted/50 active:bg-muted" : "cursor-not-allowed text-muted-foreground",
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
    </div>
  );
}
