import Link from "next/link";

import { cn } from "@/lib/utils";

type LessonTabKey = "lecture" | "exercise";

const TAB_DEFS: { key: LessonTabKey; label: string; suffix: string }[] = [
  { key: "lecture", label: "Bài giảng", suffix: "" },
  { key: "exercise", label: "Bài tập", suffix: "/exercise" },
];

/**
 * Shared header for the lecture/exercise lesson pages (design item 3):
 * back-link, phase + lesson title, and a 2-tab segmented control. Active tab
 * gets a raised card background. `basePath` is the lecture page's own URL.
 */
export function LessonTabs({
  phaseTitle,
  lessonTitle,
  basePath,
  active,
}: {
  phaseTitle: string;
  lessonTitle: string;
  basePath: string;
  active: LessonTabKey;
}) {
  return (
    <>
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-caption text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Quay lại lộ trình học
      </Link>

      <p className="text-caption font-semibold text-primary">{phaseTitle}</p>
      <h1 className="mb-4 text-h1 font-extrabold tracking-tight text-foreground">{lessonTitle}</h1>

      <div className="mb-6 inline-flex gap-1 rounded-xl bg-muted p-1">
        {TAB_DEFS.map((tab) => (
          <Link
            key={tab.key}
            href={`${basePath}${tab.suffix}`}
            className={cn(
              "flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors",
              active === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
