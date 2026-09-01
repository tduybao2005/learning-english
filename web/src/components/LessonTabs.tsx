
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
  linkComponent: Link,
}: {
  phaseTitle: string;
  lessonTitle: string;
  basePath: string;
  active: LessonTabKey;
  /** Pass `NextLink` in the app, `"a"` in a design. Required — see AppHeader. */
  linkComponent: React.ElementType;
}) {
  return (
    <>
      <Link
        href="/learn"
        className="mb-4 block w-fit text-caption text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Quay lại lộ trình học
      </Link>

      {/* Desktop (>= lg) keeps the approved header: phase line + big title above
          the tabs. On phone/tablet both are hidden here — the lesson title is
          re-emitted below the tab row so it reads as the first line of the
          body, matching the mobile/tablet design frames. */}
      <p className="hidden text-caption font-semibold text-primary lg:block">{phaseTitle}</p>
      <h1 className="mb-4 hidden text-h1 font-extrabold tracking-tight text-foreground lg:block">
        {lessonTitle}
      </h1>

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

      {/* Phone + tablet: the lesson title opens the content column, directly
          under the tab row (design frames "Bài giảng — điện thoại" / "— máy
          tính bảng": the header card holds only the back arrow + segmented
          control; the title is the first block inside the scroll area). */}
      <h1 className="mb-4 text-h1 font-extrabold tracking-tight text-foreground lg:hidden">
        {lessonTitle}
      </h1>
    </>
  );
}
