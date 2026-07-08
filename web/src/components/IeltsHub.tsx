"use client";

import Link from "next/link";
import { useState } from "react";

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
}: {
  tests: { number: number; isComplete: boolean }[];
  initialSkill?: IeltsSkill;
}) {
  const [skill, setSkill] = useState<IeltsSkill>(initialSkill);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? tests : tests.slice(0, INITIAL_VISIBLE);
  const hiddenCount = tests.length - visible.length;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h1 font-extrabold">Đề luyện IELTS</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Chọn kỹ năng, sau đó chọn đề để luyện riêng kỹ năng đó.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Kỹ năng"
          className="flex shrink-0 self-start rounded-full bg-muted p-1"
        >
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={skill === s.key}
              onClick={() => setSkill(s.key)}
              className={cn(
                "min-h-9 rounded-full px-4 text-sm font-semibold transition-colors",
                skill === s.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
        {visible.map((test) => (
          <Link
            key={test.number}
            href={`/ielts/${test.number}?skill=${skill}`}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-center transition-colors hover:bg-muted/50",
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
            className="font-semibold text-primary hover:underline"
          >
            xem tất cả
          </button>
        </p>
      )}
    </div>
  );
}
