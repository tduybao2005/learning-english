import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { getTopicSessionWords } from "@/lib/vocab-topics";
import { GameTopBar } from "@/components/vocab/GameTopBar";
import { PracticeSession } from "@/components/vocab/PracticeSession";

/**
 * Một phiên luyện tập theo CHỦ ĐỀ (tối đa 20 từ, ưu tiên từ yếu) — khác với
 * bản theo bài ở `/learn/[phase]/[lesson]/vocab/play`, vốn lấy trọn từ vựng
 * của một bài. Ghép cặp và trắc nghiệm nay nằm chung một phiên, nên chỉ còn
 * route này thay cho hai route `/quiz` và `/match` trước đây.
 */
export default async function TopicPlayPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { topic: slug } = await params;
  const session = await getTopicSessionWords(slug, user.id);
  if (session === null) notFound();

  const backHref = `/vocab/${slug}`;

  return (
    <div className="lg:fixed lg:inset-0 lg:z-50 lg:flex lg:overflow-y-auto lg:bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 lg:py-8">
        <GameTopBar backHref={backHref} label={`${session.emoji} ${session.nameVi} · Luyện tập`} />

        <div className="flex flex-1 flex-col justify-center pb-10">
          {session.words.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
              Chủ đề này chưa có từ nào để luyện.
            </p>
          ) : (
            <PracticeSession words={session.words} backHref={backHref} linkComponent={Link} />
          )}
        </div>
      </div>
    </div>
  );
}
