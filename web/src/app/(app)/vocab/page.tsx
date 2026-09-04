import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import {
  getVocabTopicsOverview,
  TOPIC_GROUP_LABELS,
  TOPIC_GROUP_ORDER,
  type TopicSummary,
} from "@/lib/vocab-topics";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

/** Nền nhạt riêng cho từng nhóm, để ba khu phân biệt được ngay từ xa. */
const GROUP_TINT = {
  EVERYDAY: "bg-primary/8 text-primary",
  ACADEMIC: "bg-accent/10 text-accent",
  FUNCTIONAL: "bg-streak-bg text-streak-foreground",
} as const;

function TopicCard({ topic }: { topic: TopicSummary }) {
  const percent = topic.total === 0 ? 0 : Math.round((topic.learned / topic.total) * 100);

  // Chủ đề chưa có từ nào vẫn hiện (làm mờ) — đó chính là bảng chỉ dẫn cho
  // biết chỗ nào cần soạn thêm từ vựng.
  if (topic.total === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-4 opacity-60">
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl grayscale">{topic.emoji}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Sắp có
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">{topic.nameVi}</p>
          <p className="line-clamp-1 text-caption text-muted-foreground">{topic.nameEn}</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/vocab/${topic.slug}`}
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
          {topic.learned}/{topic.total}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold leading-tight">{topic.nameVi}</p>
        <p className="line-clamp-1 text-caption text-muted-foreground">{topic.nameEn}</p>
      </div>

      <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </Link>
  );
}

/**
 * Trang Từ vựng: duyệt theo CHỦ ĐỀ, không theo giai đoạn/bài học nữa.
 *
 * Từ vựng được gom theo chủ đề đời sống và IELTS xuyên suốt cả chương
 * trình, nên một từ nằm ở bài nào không còn quan trọng khi tra cứu hay ôn
 * tập. Luồng học theo bài vẫn giữ nguyên ở `/learn/[phase]/[lesson]/vocab`.
 */
export default async function VocabHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { topics, totalWords, learnedWords, unclassified } = await getVocabTopicsOverview(user.id);
  const percent = totalWords === 0 ? 0 : Math.round((learnedWords / totalWords) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-h1 font-extrabold">Từ vựng</h1>
      <p className="mb-5 text-body text-muted-foreground">
        Chọn một chủ đề để luyện bằng thẻ ghi nhớ, quiz hoặc ghép cặp.
      </p>

      {totalWords > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold">
              Đã thuộc {learnedWords}
              <span className="font-normal text-muted-foreground">/{totalWords} từ</span>
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

      {topics.length === 0 ? (
        <EmptyState
          icon="📖"
          title="Chưa có từ vựng nào"
          description="Quay lại sau khi nội dung từ vựng được thêm vào."
          linkComponent={Link}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {TOPIC_GROUP_ORDER.map((group) => {
            const inGroup = topics.filter((t) => t.group === group);
            if (inGroup.length === 0) return null;
            const groupWords = inGroup.reduce((sum, t) => sum + t.total, 0);
            return (
              <section key={group}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-h2 font-bold">{TOPIC_GROUP_LABELS[group]}</h2>
                  <span className="text-caption text-muted-foreground">
                    {inGroup.length} chủ đề · {groupWords} từ
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

          {/* Trung thực về phần chưa làm xong, thay vì giấu đi. */}
          {unclassified > 0 && (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-caption text-muted-foreground">
              Còn {unclassified} từ chưa được xếp chủ đề — vẫn học được qua từng bài ở phần Lộ trình,
              và sẽ xuất hiện ở đây khi được phân loại xong.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
