import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getLessonStates } from "@/lib/progress";
import { Flashcards } from "@/components/vocab/Flashcards";

export default async function FlashcardsPage({
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

  const words = await db.vocabWord.findMany({
    where: { lessonId: lesson.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, word: true, ipa: true, meaningVi: true, exampleEn: true, groupName: true },
  });

  const base = `/learn/${phaseSlug}/${lessonSlug}`;
  const backHref = `${base}/vocab`;

  return (
    <div className="lg:fixed lg:inset-0 lg:z-50 lg:overflow-y-auto lg:bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:py-10">
        <Link
          href={backHref}
          className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Quay lại từ vựng
        </Link>

        <p className="text-caption font-semibold text-primary">{lesson.phase.title}</p>
        <h1 className="mb-6 text-h2 font-extrabold">Flashcards — {lesson.title}</h1>

        {words.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            Bài học này chưa có từ vựng.
          </p>
        ) : (
          <Flashcards words={words} backHref={backHref} linkComponent={Link} />
        )}
      </div>
    </div>
  );
}
