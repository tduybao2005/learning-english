import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getTopicDetail, TOPIC_GROUP_LABELS } from "@/lib/vocab-topics";
import { TopicWordList } from "@/components/vocab/TopicWordList";

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** Dưới ngần này từ thì phiên luyện tập không dựng nổi đáp án nhiễu. */
const MIN_PRACTICE_WORDS = 4;

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { topic: slug } = await params;
  const topic = await getTopicDetail(slug, user.id);
  if (topic === null) notFound();

  const total = topic.words.length;
  const percent = total === 0 ? 0 : Math.round((topic.learned / total) * 100);
  const learning = topic.words.filter((w) => w.status === "learning").length;
  const canPractice = topic.words.filter((w) => w.meaningVi !== "").length >= MIN_PRACTICE_WORDS;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/vocab"
          aria-label="Quay lại danh sách chủ đề"
          className="press-btn flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:shadow-sm active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="truncate rounded-full bg-muted px-3 py-1.5 text-caption font-semibold text-muted-foreground">
          {TOPIC_GROUP_LABELS[topic.group]}
        </span>
      </div>

      {/* Hero: danh tính chủ đề, tiến độ và lối vào luyện tập gom trong một
          khối — trước đây phải cuộn qua ba khối rời mới thấy nút luyện tập. */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-4 bg-primary p-5 text-primary-foreground">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl">
            {topic.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h1 font-extrabold leading-tight">{topic.nameVi}</h1>
            <p className="truncate text-caption text-primary-foreground/80">{topic.nameEn}</p>
            <p className="mt-1 text-caption font-semibold text-primary-foreground/90">
              Đã thuộc {topic.learned}/{total} từ
              {learning > 0 && <> · đang học {learning}</>}
            </p>
          </div>
          <div className="relative hidden size-16 shrink-0 sm:block">
            <svg viewBox="0 0 64 64" className="size-full -rotate-90">
              <circle cx="32" cy="32" r={RING_RADIUS} fill="none" strokeWidth="7" className="stroke-white/25" />
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                className="stroke-white"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {percent}%
            </span>
          </div>
        </div>

        {total > 0 && (
          <div className="flex flex-col gap-2 p-4 sm:flex-row">
            {canPractice ? (
              <Link
                href={`/vocab/${topic.slug}/play`}
                className={cn(buttonVariants({ size: "lg" }), "flex-1 gap-2 text-base")}
              >
                ▶ Luyện tập
              </Link>
            ) : (
              <span className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-4 py-3 text-caption text-muted-foreground">
                Cần ít nhất {MIN_PRACTICE_WORDS} từ mới luyện tập được
              </span>
            )}
            <Link
              href={`/vocab/${topic.slug}/flashcards`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 sm:w-56")}
            >
              🃏 Thẻ ghi nhớ
            </Link>
          </div>
        )}
      </section>

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-muted-foreground">
          Chủ đề này chưa có từ nào. Nội dung sẽ được bổ sung dần.
        </p>
      ) : (
        <TopicWordList words={topic.words} />
      )}
    </div>
  );
}
