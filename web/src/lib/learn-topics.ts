import { db } from "@/lib/db";
import { getLessonStates, type LessonState } from "@/lib/progress";
import { LESSON_TOPICS, lessonKey, type LessonTopicGroup } from "@/lib/lesson-topics";

/**
 * Ghép taxonomy chủ đề (hằng số) với bài học + tiến độ (DB) thành dữ liệu cho
 * trang Lộ trình mới.
 *
 * `buildLearnTopics` là hàm THUẦN, tách hẳn khỏi truy vấn, để phần logic dễ
 * sai nhất — gom nhóm và đếm tiến độ — test được mà không cần Postgres.
 */

/**
 * Bốn trạng thái hiển thị của một bài.
 *
 * `skipped` cố ý KHÔNG gộp vào `done`: bài kiểm tra đầu vào ghi SKIPPED cho
 * mọi bài trước điểm được xếp, nên gộp lại thì một người vừa thi xong đã thấy
 * "đã học 23/52 bài" dù chưa học buổi nào. Lộ trình mới không khoá bài, nên
 * "đã bỏ qua" đọc đúng nghĩa: bạn được xếp bắt đầu sau bài này, muốn học lại
 * vẫn vào được.
 */
export type LessonStatus4 = "done" | "learning" | "skipped" | "new";

export function toLessonStatus(state: LessonState | undefined): LessonStatus4 {
  if (state === "COMPLETED") return "done";
  if (state === "UNLOCKED") return "learning";
  if (state === "SKIPPED") return "skipped";
  return "new";
}

export interface TopicLesson {
  id: string;
  slug: string;
  phaseSlug: string;
  title: string;
  phaseTitle: string;
  phaseOrderIndex: number;
  orderIndex: number;
  wordCount: number;
  status: LessonStatus4;
  href: string;
}

export interface LearnTopicSummary {
  slug: string;
  nameVi: string;
  nameEn: string;
  emoji: string;
  group: LessonTopicGroup;
  description: string;
  total: number;
  done: number;
  learning: number;
}

export interface LearnTopicDetail extends LearnTopicSummary {
  lessons: TopicLesson[];
}

/** Hàng bài học phẳng lấy từ DB — hình dạng tối thiểu `buildLearnTopics` cần. */
export interface LessonRow {
  id: string;
  slug: string;
  title: string;
  orderIndex: number;
  phaseSlug: string;
  phaseTitle: string;
  phaseOrderIndex: number;
  wordCount: number;
}

export function buildLearnTopics(
  rows: LessonRow[],
  states: Map<string, LessonState>,
): LearnTopicDetail[] {
  const byKey = new Map(rows.map((r) => [lessonKey(r.phaseSlug, r.slug), r]));

  return LESSON_TOPICS.map((topic) => {
    const lessons: TopicLesson[] = [];
    // Duyệt theo `lessonKeys` chứ không theo `rows`: thứ tự học trong một chủ
    // đề do taxonomy quyết định (dễ → khó), không phải thứ tự giai đoạn.
    for (const key of topic.lessonKeys) {
      const row = byKey.get(key);
      // Bài có trong taxonomy mà chưa có trong DB (chưa seed) thì bỏ qua —
      // trang vẫn dựng được, chỉ là chủ đề đó ít bài hơn.
      if (row === undefined) continue;
      lessons.push({
        id: row.id,
        slug: row.slug,
        phaseSlug: row.phaseSlug,
        title: row.title,
        phaseTitle: row.phaseTitle,
        phaseOrderIndex: row.phaseOrderIndex,
        orderIndex: row.orderIndex,
        wordCount: row.wordCount,
        status: toLessonStatus(states.get(row.id)),
        href: `/learn/${row.phaseSlug}/${row.slug}`,
      });
    }

    return {
      slug: topic.slug,
      nameVi: topic.nameVi,
      nameEn: topic.nameEn,
      emoji: topic.emoji,
      group: topic.group,
      description: topic.description,
      total: lessons.length,
      done: lessons.filter((l) => l.status === "done").length,
      learning: lessons.filter((l) => l.status === "learning").length,
      lessons,
    };
  });
}

async function fetchLessonRows(): Promise<LessonRow[]> {
  const lessons = await db.lesson.findMany({
    orderBy: [{ phase: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      orderIndex: true,
      phase: { select: { slug: true, title: true, orderIndex: true } },
      _count: { select: { words: true } },
    },
  });

  return lessons.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    orderIndex: l.orderIndex,
    phaseSlug: l.phase.slug,
    phaseTitle: l.phase.title,
    phaseOrderIndex: l.phase.orderIndex,
    wordCount: l._count.words,
  }));
}

export async function getLearnTopics(userId: string): Promise<LearnTopicDetail[]> {
  const [rows, states] = await Promise.all([fetchLessonRows(), getLessonStates(userId)]);
  return buildLearnTopics(rows, states);
}

export async function getLearnTopicDetail(
  slug: string,
  userId: string,
): Promise<LearnTopicDetail | null> {
  const topics = await getLearnTopics(userId);
  return topics.find((t) => t.slug === slug) ?? null;
}
