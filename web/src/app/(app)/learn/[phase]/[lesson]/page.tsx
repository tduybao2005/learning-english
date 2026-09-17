import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { MarkdownContent } from "@/components/MarkdownContent";
import { InlineExample } from "@/components/InlineExample";
import { splitLectureSegments } from "@/lib/lecture-examples";
import { LessonTabs } from "@/components/LessonTabs";
import { buttonVariants } from "@/components/ui/button";
import { extractToc } from "@/lib/toc";
import { LectureToc } from "@/components/LectureToc";

export default async function LecturePage({
  params,
}: {
  params: Promise<{ phase: string; lesson: string }>;
}) {
  const { phase: phaseSlug, lesson: lessonSlug } = await params;

  const lesson = await db.lesson.findFirst({
    where: { slug: lessonSlug, phase: { slug: phaseSlug } },
    include: { phase: true },
  });

  if (!lesson) notFound();

  const base = `/learn/${phaseSlug}/${lessonSlug}`;

  const toc = extractToc(lesson.lectureMd);

  // Interactive ```example blocks are pulled out server-side: only the
  // answer-free SafeExample crosses to the client.
  const segments = splitLectureSegments(lesson.lectureMd);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,680px)_220px] lg:justify-center lg:gap-10">
      <div>
        <LessonTabs
          phaseTitle={lesson.phase.title}
          lessonTitle={lesson.title}
          basePath={base}
          active="lecture"
          linkComponent={Link}
        />

        {segments.map((segment, i) =>
          segment.type === "markdown" ? (
            <MarkdownContent key={i} content={segment.content} stripFrontmatter={false} />
          ) : (
            <InlineExample
              key={segment.example.id}
              lessonId={lesson.id}
              example={segment.example}
            />
          ),
        )}

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-8">
          <p className="text-caption text-muted-foreground">
            Đã đọc xong? Luyện tập ngay để mở khoá bài tiếp theo.
          </p>
          <Link
            href={`${base}/exercise`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "w-full shadow-primary-glow transition-all hover:shadow-lg active:shadow-none sm:w-auto",
            )}
          >
            Làm bài tập →
          </Link>
        </div>
      </div>

      <LectureToc entries={toc} />
    </div>
  );
}
