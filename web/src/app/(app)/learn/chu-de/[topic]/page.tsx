import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { getLearnTopicDetail } from "@/lib/learn-topics";
import { LESSON_TOPIC_GROUP_LABELS } from "@/lib/lesson-topics";
import { TopicLessonList } from "@/components/learn/TopicLessonList";

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default async function LearnTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const user = await getSessionUser();

  const { topic: slug } = await params;
  const topic = await getLearnTopicDetail(slug, user?.id ?? null);
  if (topic === null) notFound();

  const percent = topic.total === 0 ? 0 : Math.round((topic.done / topic.total) * 100);
  // Bài để "Tiếp tục": bài đang học đầu tiên, nếu không có thì bài chưa học
  // đầu tiên. Chủ đề học xong hết thì không hiện nút.
  const nextLesson =
    topic.lessons.find((l) => l.status === "learning") ??
    topic.lessons.find((l) => l.status === "new") ??
    null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/learn"
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
          {LESSON_TOPIC_GROUP_LABELS[topic.group]}
        </span>
      </div>

      {/* Hero: danh tính chủ đề, tiến độ và lối vào bài kế gom trong một khối
          — cùng bố cục với trang chủ đề Từ vựng. */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-4 bg-primary p-5 text-primary-foreground">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl">
            {topic.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-h1 font-extrabold leading-tight">{topic.nameVi}</h1>
            <p className="line-clamp-2 text-caption text-primary-foreground/80">
              {topic.description}
            </p>
            <p className="mt-1 text-caption font-semibold text-primary-foreground/90">
              Đã học {topic.done}/{topic.total} bài
              {topic.learning > 0 && <> · đang học {topic.learning}</>}
            </p>
          </div>
          <div className="relative hidden size-16 shrink-0 sm:block">
            <svg viewBox="0 0 64 64" className="size-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="7"
                className="stroke-white/25"
              />
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

        {nextLesson !== null && (
          <div className="p-4">
            {/* Nút hai dòng: nhãn hành động ở trên, tên bài ở dưới và cắt được.
                Tiêu đề bài do seed sinh ra viết hoa toàn bộ và dài (vd "BÀI 1:
                THỂ BỊ ĐỘNG (PASSIVE VOICE)") — nhồi tất cả vào một dòng thì
                chữ tràn ra ngoài viền, còn ký tự ▶ dạng text thì bị cắt mất
                nửa bên trái. Icon vẽ bằng SVG trong huy hiệu tròn không có
                cả hai vấn đề đó. */}
            <Link
              href={nextLesson.href}
              className="press-tile group flex min-h-11 w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-primary-glow transition-all hover:-translate-y-0.5 hover:shadow-lg active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-caption font-semibold uppercase tracking-wider text-primary-foreground/75">
                  {nextLesson.status === "learning" ? "Học tiếp" : "Bắt đầu"}
                </span>
                <span className="block truncate font-bold">{nextLesson.title}</span>
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 shrink-0 text-primary-foreground/70 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        )}
      </section>

      {topic.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-muted-foreground">
          Chủ đề này chưa có bài nào.
        </p>
      ) : (
        <TopicLessonList lessons={topic.lessons} linkComponent={Link} />
      )}
    </div>
  );
}
