import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { getTopicDetail, TOPIC_GROUP_LABELS } from "@/lib/vocab-topics";
import { TopicWordList } from "@/components/vocab/TopicWordList";

const MODES = [
  { slug: "flashcards", icon: "🃏", title: "Thẻ ghi nhớ", desc: "Lật thẻ, vuốt để tự đánh giá" },
  { slug: "quiz", icon: "⚡", title: "Quiz trắc nghiệm", desc: "4 đáp án · tính chuỗi đúng" },
  { slug: "match", icon: "🧩", title: "Ghép cặp", desc: "Nối từ với nghĩa tương ứng" },
] as const;

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { topic: slug } = await params;
  const topic = await getTopicDetail(slug, user.id);
  if (topic === null) notFound();

  const total = topic.words.length;
  const percent = total === 0 ? 0 : Math.round((topic.learned / total) * 100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/vocab"
          aria-label="Quay lại danh sách chủ đề"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
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

      <div className="mb-6 flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-4xl">
          {topic.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-h1 font-extrabold leading-tight">{topic.nameVi}</h1>
          <p className="text-caption text-muted-foreground">{topic.nameEn}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold">
            Đã thuộc {topic.learned}
            <span className="font-normal text-muted-foreground">/{total} từ</span>
          </span>
          <span className="text-caption text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-muted-foreground">
          Chủ đề này chưa có từ nào. Nội dung sẽ được bổ sung dần.
        </p>
      ) : (
        <>
          <p className="mb-3 text-caption font-semibold text-muted-foreground">
            Chọn chế độ luyện tập
          </p>
          <div className="mb-8 grid gap-2 sm:grid-cols-3">
            {MODES.map((mode) => (
              <Link
                key={mode.slug}
                href={`/vocab/${topic.slug}/${mode.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:flex-col sm:items-start"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg">
                  {mode.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{mode.title}</span>
                  <span className="block text-caption text-muted-foreground">{mode.desc}</span>
                </span>
              </Link>
            ))}
          </div>

          <TopicWordList words={topic.words} />
        </>
      )}
    </div>
  );
}
