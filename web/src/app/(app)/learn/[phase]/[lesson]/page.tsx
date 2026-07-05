import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { MarkdownContent } from "@/components/MarkdownContent";
import { cn } from "@/lib/utils";

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
  const tabs = [
    { href: base, label: "Bài giảng", active: true },
    { href: `${base}/vocab`, label: "Từ vựng", active: false },
    { href: `${base}/exercise`, label: "Bài tập", active: false },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Quay lại lộ trình học
      </Link>

      <p className="text-sm font-medium text-primary">{lesson.phase.title}</p>
      <h1 className="mb-4 text-2xl font-bold">{lesson.title}</h1>

      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab.active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <MarkdownContent content={lesson.lectureMd} />
    </div>
  );
}
