"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { TocEntry } from "@/lib/toc";

/**
 * "TRONG BÀI" table-of-contents rail for the lecture page (mockup 05-d).
 * Desktop-only (hidden below lg). Scrollspy via IntersectionObserver: the
 * topmost visible H2 gets the primary left-bar highlight.
 */
export function LectureToc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed.filter((o) => o.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "0% 0% -70% 0%" },
    );
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="Trong bài" className="sticky top-8 hidden self-start lg:block">
      <p className="mb-3 text-caption font-bold tracking-wide text-muted-foreground">TRONG BÀI</p>
      <ul className="flex flex-col gap-1 border-l border-border">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={cn(
                "-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors",
                activeId === entry.id
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground active:text-foreground",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
