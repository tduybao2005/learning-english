import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { GameTopBar } from "@/components/vocab/GameTopBar";
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
    select: {
      id: true,
      word: true,
      ipa: true,
      meaningVi: true,
      exampleEn: true,
      groupName: true,
      audioUrl: true,
    },
  });

  const base = `/learn/${phaseSlug}/${lessonSlug}`;
  const backHref = `${base}/vocab`;

  return (
    <div className="lg:fixed lg:inset-0 lg:z-50 lg:flex lg:overflow-y-auto lg:bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 lg:py-8">
        <GameTopBar
          backHref={backHref}
          label={`GĐ ${lesson.phase.orderIndex} · Bài ${lesson.orderIndex} · Thẻ ghi nhớ`}
        />

        <div className="flex flex-1 flex-col justify-center pb-10">
        {words.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            Bài học này chưa có từ vựng.
          </p>
        ) : (
          <Flashcards words={words} backHref={backHref} linkComponent={Link} />
        )}
        </div>
      </div>
    </div>
  );
}
