import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { MarkdownContent } from "@/components/MarkdownContent";
import { LessonTabs } from "@/components/LessonTabs";

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LessonTabs
        phaseTitle={lesson.phase.title}
        lessonTitle={lesson.title}
        basePath={base}
        active="lecture"
      />

      <MarkdownContent content={lesson.lectureMd} />
    </div>
  );
}
