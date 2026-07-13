"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import type { IeltsSkill } from "@/lib/ielts-answer-key";

const SKILLS: { key: IeltsSkill; label: string }[] = [
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
  { key: "speaking", label: "Speaking" },
];

const INITIAL_VISIBLE = 16;

/**
 * IELTS hub body (mockup 09-d): segmented skill tabs + numbered test grid.
 * The selected skill only changes which tab the detail page opens on
 * (`?skill=` deep-link) — tests aren't filtered, since every test contains
 * all three skills. Client component purely for the tab + "xem tất cả" state.
 */
export function IeltsHub({
  tests,
  initialSkill = "reading",
  linkComponent: Link,
}: {
  tests: { number: number; isComplete: boolean }[];
  initialSkill?: IeltsSkill;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
  const [skill, setSkill] = useState<IeltsSkill>(initialSkill);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? tests : tests.slice(0, INITIAL_VISIBLE);
  const hiddenCount = tests.length - visible.length;

  return (
    <div>
      {/* lg: keeps the shipped header (title + blurb, tabs pulled right). Below
       * lg the tabs stack under the title and a back link to the exam-type hub
       * replaces the sidebar's "Đề thi" entry. */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/exams"
              aria-label="Quay lại Đề thi"
              className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
            <h1 className="text-h1 font-extrabold">
              <span className="max-lg:hidden">Đề luyện </span>IELTS
            </h1>
          </div>
          <p className="mt-1 hidden text-body text-muted-foreground lg:block">
            Chọn kỹ năng, sau đó chọn đề để luyện riêng kỹ năng đó.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Kỹ năng"
          className="flex shrink-0 self-start max-lg:flex-wrap max-lg:gap-2 lg:rounded-full lg:bg-muted lg:p-1"
        >
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={skill === s.key}
              onClick={() => setSkill(s.key)}
              className={cn(
                "rounded-full px-4 text-sm font-semibold transition-colors",
                "max-lg:min-h-11 max-lg:border max-lg:border-border",
                "lg:min-h-9",
                skill === s.key
                  ? "max-lg:border-primary max-lg:bg-primary max-lg:text-primary-foreground lg:bg-card lg:text-foreground lg:shadow-sm"
                  : "max-lg:bg-card max-lg:text-muted-foreground lg:text-muted-foreground lg:hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-caption font-bold tracking-wider text-muted-foreground uppercase lg:hidden">
        Chọn đề
      </p>

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
        {visible.map((test) => (
          <Link
            key={test.number}
            href={`/ielts/${test.number}?skill=${skill}`}
            className={cn(
              // Squares are a desktop luxury: on a phone they'd eat the fold,
              // so below lg: the tile is a short 56px+ button instead.
              "flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-center transition-colors hover:bg-muted/50",
              "max-lg:min-h-14 max-lg:px-1 max-lg:py-2 lg:aspect-square",
              !test.isComplete && "opacity-60 hover:opacity-80",
            )}
          >
            <p className="text-h2 font-bold">{String(test.number).padStart(2, "0")}</p>
            {!test.isComplete && (
              <span className="px-1 text-caption font-medium text-muted-foreground">
                Chưa đủ nội dung
              </span>
            )}
          </Link>
        ))}
      </div>

      {hiddenCount > 0 && (
        <p className="mt-4 text-center text-caption text-muted-foreground">
          Còn {hiddenCount} đề ·{" "}
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="font-semibold text-primary hover:underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center max-lg:px-2"
          >
            xem tất cả
          </button>
        </p>
      )}
    </div>
  );
}
