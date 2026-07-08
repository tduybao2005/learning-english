import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { MarkdownContent } from "@/components/MarkdownContent";
import { LessonTabs } from "@/components/LessonTabs";
import { buttonVariants } from "@/components/ui/button";
import { extractToc } from "@/lib/toc";
import { LectureToc } from "@/components/LectureToc";

export default async function LecturePage({
  params,
}: {
  params: Promise<{ phase: string; lesson: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { phase: phaseSlug, lesson: lessonSlug } = await params;

  const lesson = await db.lesson.findFirst({
    where: { slug: lessonSlug, phase: { slug: phaseSlug } },
    include: { phase: true },
  });

  if (!lesson) notFound();

  // Guard: a locked lesson's URL is not viewable — bounce back to the dashboard.
  const states = await getLessonStates(user.id);
  const state = states.get(lesson.id) ?? "LOCKED";
  if (state === "LOCKED") redirect("/dashboard");

  const base = `/learn/${phaseSlug}/${lessonSlug}`;

  const toc = extractToc(lesson.lectureMd);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,680px)_220px] lg:justify-center lg:gap-10">
      <div>
        <LessonTabs
          phaseTitle={lesson.phase.title}
          lessonTitle={lesson.title}
          basePath={base}
          active="lecture"
        />

        <MarkdownContent content={lesson.lectureMd} />

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-8">
          <p className="text-caption text-muted-foreground">
            Đã đọc xong? Luyện tập ngay để mở khoá bài tiếp theo.
          </p>
          <Link
            href={`${base}/exercise`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "w-full shadow-primary-glow transition-shadow hover:shadow-lg sm:w-auto",
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
