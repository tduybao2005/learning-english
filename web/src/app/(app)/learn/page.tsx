import Link from "next/link";
import { redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { getLearnTopics, type LearnTopicDetail } from "@/lib/learn-topics";
import { LESSON_TOPIC_GROUP_LABELS, LESSON_TOPIC_GROUP_ORDER } from "@/lib/lesson-topics";
import { EmptyState } from "@/components/EmptyState";

/** Nền nhạt riêng cho từng nhóm, để bốn khu phân biệt được ngay từ xa —
 * cùng thủ pháp với lưới chủ đề ở trang Từ vựng. */
const GROUP_TINT = {
  CORE: "bg-primary/8 text-primary",
  ADVANCED: "bg-accent/10 text-accent",
  VOCAB: "bg-streak-bg text-streak-foreground",
  IELTS: "bg-success-bg text-success",
} as const;

function TopicCard({ topic }: { topic: LearnTopicDetail }) {
  const percent = topic.total === 0 ? 0 : Math.round((topic.done / topic.total) * 100);

  if (topic.total === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-4 opacity-60">
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl grayscale">{topic.emoji}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Sắp có
          </span>
        </div>
        <p className="text-sm font-semibold leading-tight">{topic.nameVi}</p>
      </div>
    );
  }

  return (
    <Link
      href={`/learn/chu-de/${topic.slug}`}
      data-testid="learn-topic-card"
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 press-tile transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-xl text-2xl",
            GROUP_TINT[topic.group],
          )}
        >
          {topic.emoji}
        </span>
        <span className="text-caption font-semibold text-muted-foreground">
          {topic.done}/{topic.total}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold leading-tight">{topic.nameVi}</p>
        <p className="line-clamp-2 text-caption text-muted-foreground">{topic.description}</p>
      </div>

      {topic.learning > 0 && (
        <span className="w-fit rounded-full bg-streak-bg px-2 py-0.5 text-[11px] font-bold text-streak-foreground">
          Đang học {topic.learning}
        </span>
      )}

      <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </Link>
  );
}

/**
 * Lộ trình học duyệt theo CHỦ ĐỀ, không theo giai đoạn.
 *
 * Giai đoạn 1–5 là thứ tự soạn nội dung, không phải cách người học nghĩ về
 * tiếng Anh: ai muốn ôn câu bị động phải nhớ nó nằm ở Giai đoạn 3 và 4 rồi
 * mở hai chỗ. Ở đây "Câu bị động" là một chủ đề, hai bài nằm cạnh nhau.
 *
 * Không còn ổ khoá: mọi bài đều vào được, thẻ chỉ cho biết đã học tới đâu.
 */
export default async function LearnHubPage() {
  const user = await getSessionUser();
  const topics = await getLearnTopics(user?.id ?? null);
  const totalLessons = topics.reduce((sum, t) => sum + t.total, 0);
  const doneLessons = topics.reduce((sum, t) => sum + t.done, 0);
  const percent = totalLessons === 0 ? 0 : Math.round((doneLessons / totalLessons) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-h1 font-extrabold">Lộ trình</h1>
      <p className="mb-5 text-body text-muted-foreground">
        Chọn một chủ đề để học bài giảng và làm bài tập.
      </p>

      {totalLessons > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold">
              Đã học {doneLessons}
              <span className="font-normal text-muted-foreground">/{totalLessons} bài</span>
            </span>
            <span className="text-caption text-muted-foreground">{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {totalLessons === 0 ? (
        <EmptyState
          icon="🌱"
          title="Chưa có gì ở đây"
          description="Nội dung bài học chưa được nạp vào hệ thống."
          linkComponent={Link}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {LESSON_TOPIC_GROUP_ORDER.map((group) => {
            const inGroup = topics.filter((t) => t.group === group);
            if (inGroup.length === 0) return null;
            const groupLessons = inGroup.reduce((sum, t) => sum + t.total, 0);
            return (
              <section key={group}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-h2 font-bold">{LESSON_TOPIC_GROUP_LABELS[group]}</h2>
                  <span className="text-caption text-muted-foreground">
                    {inGroup.length} chủ đề · {groupLessons} bài
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {inGroup.map((topic) => (
                    <TopicCard key={topic.slug} topic={topic} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
