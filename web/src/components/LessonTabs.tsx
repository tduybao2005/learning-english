import Link from "next/link";

import { cn } from "@/lib/utils";

type LessonTabKey = "lecture" | "vocab" | "exercise";

const TAB_DEFS: { key: LessonTabKey; label: string; suffix: string }[] = [
  { key: "lecture", label: "Bài giảng", suffix: "" },
  { key: "vocab", label: "Từ vựng", suffix: "/vocab" },
  { key: "exercise", label: "Bài tập", suffix: "/exercise" },
];

/**
 * Shared header for the three lesson-scoped pages (design doc §06): back-link,
 * phase + lesson title, and the 3-tab bar. Active tab gets a primary
 * underline. `basePath` is the lecture page's own URL.
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

      <div className="mb-6 flex gap-1 border-b border-border">
        {TAB_DEFS.map((tab) => (
          <Link
            key={tab.key}
            href={`${basePath}${tab.suffix}`}
            className={cn(
              "min-h-11 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              active === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
