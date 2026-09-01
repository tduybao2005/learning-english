import { db } from "@/lib/db";
import { LEARNED_BOX_THRESHOLD } from "@/lib/vocab";

/**
 * Truy vấn cho trang Từ vựng theo chủ đề.
 *
 * Mọi phép đếm đều theo TỪ ĐÃ KHỬ TRÙNG (`lower(trim(word))`), không theo
 * dòng `VocabWord`: 3.419 dòng chỉ là 2.706 từ khác nhau, 482 từ nằm ở
 * nhiều bài. Nếu đếm theo dòng thì một chủ đề sẽ hiện "confirm" 6 lần và
 * tiến độ không bao giờ chạm 100%.
 */

export type TopicGroup = "EVERYDAY" | "ACADEMIC" | "FUNCTIONAL";

export const TOPIC_GROUP_LABELS: Record<TopicGroup, string> = {
  EVERYDAY: "Đời sống",
  ACADEMIC: "Học thuật & IELTS",
  FUNCTIONAL: "Ngôn ngữ chức năng",
};

export const TOPIC_GROUP_ORDER: TopicGroup[] = ["EVERYDAY", "ACADEMIC", "FUNCTIONAL"];

export interface TopicSummary {
  slug: string;
  nameVi: string;
  nameEn: string;
  emoji: string;
  group: TopicGroup;
  orderIndex: number;
  /** Số từ khác nhau thuộc chủ đề này. */
  total: number;
  /** Số từ trong đó người học đã thuộc (hộp Leitner >= ngưỡng). */
  learned: number;
}

export interface VocabTopicsOverview {
  topics: TopicSummary[];
  totalWords: number;
  learnedWords: number;
  /** Số từ khác nhau chưa được gán chủ đề — hiện thành mục riêng cuối trang. */
  unclassified: number;
}

export async function getVocabTopicsOverview(userId: string): Promise<VocabTopicsOverview> {
  const [topicRows, learnedRows, totals] = await Promise.all([
    db.$queryRaw<
      {
        slug: string;
        nameVi: string;
        nameEn: string;
        emoji: string;
        group: TopicGroup;
        orderIndex: number;
        total: bigint;
      }[]
    >`
      SELECT t.slug, t."nameVi", t."nameEn", t.emoji, t."group", t."orderIndex",
             count(DISTINCT lower(trim(w.word))) AS total
      FROM "VocabTopic" t
      LEFT JOIN "VocabWord" w ON w."topicId" = t.id
      GROUP BY t.id, t.slug, t."nameVi", t."nameEn", t.emoji, t."group", t."orderIndex"
      ORDER BY t."group", t."orderIndex"
    `,
    db.$queryRaw<{ slug: string | null; learned: bigint }[]>`
      SELECT t.slug, count(DISTINCT lower(trim(w.word))) AS learned
      FROM "VocabProgress" p
      JOIN "VocabWord" w ON w.id = p."wordId"
      LEFT JOIN "VocabTopic" t ON t.id = w."topicId"
      WHERE p."userId" = ${userId} AND p.box >= ${LEARNED_BOX_THRESHOLD}
      GROUP BY t.slug
    `,
    db.$queryRaw<{ total: bigint; unclassified: bigint }[]>`
      SELECT count(DISTINCT lower(trim(word))) AS total,
             count(DISTINCT lower(trim(word))) FILTER (WHERE "topicId" IS NULL) AS unclassified
      FROM "VocabWord"
    `,
  ]);

  const learnedBySlug = new Map(learnedRows.map((r) => [r.slug, Number(r.learned)]));

  const topics: TopicSummary[] = topicRows.map((t) => ({
    slug: t.slug,
    nameVi: t.nameVi,
    nameEn: t.nameEn,
    emoji: t.emoji,
    group: t.group,
    orderIndex: t.orderIndex,
    total: Number(t.total),
    learned: learnedBySlug.get(t.slug) ?? 0,
  }));

  return {
    topics,
    totalWords: Number(totals[0]?.total ?? 0),
    learnedWords: topics.reduce((sum, t) => sum + t.learned, 0),
    unclassified: Number(totals[0]?.unclassified ?? 0),
  };
}

/** Trạng thái học của một từ, suy từ hộp Leitner cao nhất người học đạt được. */
export type TopicWordStatus = "new" | "learning" | "learned";

export interface TopicWord {
  id: string;
  word: string;
  ipa: string;
  meaningVi: string;
  exampleEn: string;
  audioUrl: string | null;
  /** Bài học đầu tiên có từ này — hiện dưới dạng nhãn mờ "GĐ 1 · Bài 3". */
  phaseOrder: number;
  lessonOrder: number;
  status: TopicWordStatus;
}

export interface TopicDetail {
  slug: string;
  nameVi: string;
  nameEn: string;
  emoji: string;
  group: TopicGroup;
  words: TopicWord[];
  learned: number;
}

/**
 * Danh sách từ của một chủ đề, đã khử trùng theo `lower(trim(word))`: mỗi từ
 * chỉ lấy lần xuất hiện SỚM NHẤT (pha → bài → vị trí trong bài). Danh sách
 * hiển thị, bộ từ luyện tập và số liệu tiến độ đều dùng chung tập này.
 */
export async function getTopicDetail(slug: string, userId: string): Promise<TopicDetail | null> {
  const topic = await db.vocabTopic.findUnique({
    where: { slug },
    select: { slug: true, nameVi: true, nameEn: true, emoji: true, group: true },
  });
  if (topic === null) return null;

  const [rows, boxRows] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        word: string;
        ipa: string;
        meaningVi: string;
        exampleEn: string;
        audioUrl: string | null;
        phaseOrder: number;
        lessonOrder: number;
      }[]
    >`
      SELECT DISTINCT ON (lower(trim(w.word)))
        w.id, w.word, w.ipa, w."meaningVi", w."exampleEn", w."audioUrl",
        p."orderIndex" AS "phaseOrder", l."orderIndex" AS "lessonOrder"
      FROM "VocabWord" w
      JOIN "Lesson" l ON l.id = w."lessonId"
      JOIN "Phase" p ON p.id = l."phaseId"
      JOIN "VocabTopic" t ON t.id = w."topicId"
      WHERE t.slug = ${slug}
      ORDER BY lower(trim(w.word)), p."orderIndex", l."orderIndex", w."orderIndex"
    `,
    // Hộp Leitner CAO NHẤT trong mọi dòng của cùng một từ: một từ có mặt ở
    // nhiều bài thì tiến độ ở bài nào cũng là tiến độ của chính từ đó.
    db.$queryRaw<{ key: string; box: number }[]>`
      SELECT lower(trim(w.word)) AS key, max(pr.box)::int AS box
      FROM "VocabWord" w
      JOIN "VocabProgress" pr ON pr."wordId" = w.id
      JOIN "VocabTopic" t ON t.id = w."topicId"
      WHERE pr."userId" = ${userId} AND t.slug = ${slug}
      GROUP BY lower(trim(w.word))
    `,
  ]);

  const boxByKey = new Map(boxRows.map((r) => [r.key, r.box]));
  const words: TopicWord[] = rows.map((row) => {
    const box = boxByKey.get(row.word.trim().toLowerCase());
    const status: TopicWordStatus =
      box === undefined ? "new" : box >= LEARNED_BOX_THRESHOLD ? "learned" : "learning";
    return { ...row, status };
  });

  return {
    ...topic,
    group: topic.group as TopicGroup,
    words,
    learned: words.filter((w) => w.status === "learned").length,
  };
}

/**
 * Bộ từ cho MỘT phiên luyện tập của chủ đề.
 *
 * Game theo bài nhận trọn ~70 từ của bài đó, nhưng một chủ đề có thể tới
 * hơn 200 từ — quăng hết vào một phiên là không học nổi. Mỗi phiên lấy tối
 * đa `limit` từ, ưu tiên: chưa từng ôn → hộp Leitner thấp nhất → lâu chưa
 * ôn nhất. Học lại nhiều lần sẽ tự xoay vòng hết chủ đề và bám vào từ yếu.
 */
export async function getTopicSessionWords(
  slug: string,
  userId: string,
  limit = 20,
): Promise<{ nameVi: string; emoji: string; words: TopicWord[] } | null> {
  const topic = await getTopicDetail(slug, userId);
  if (topic === null) return null;

  const progress = await db.vocabProgress.findMany({
    where: { userId, wordId: { in: topic.words.map((w) => w.id) } },
    select: { wordId: true, box: true, lastReviewedAt: true },
  });
  const progressByWordId = new Map(progress.map((p) => [p.wordId, p]));

  const ranked = [...topic.words].sort((a, b) => {
    const pa = progressByWordId.get(a.id);
    const pb = progressByWordId.get(b.id);
    // Chưa từng ôn xếp trước tất cả.
    if (pa === undefined && pb !== undefined) return -1;
    if (pa !== undefined && pb === undefined) return 1;
    if (pa === undefined || pb === undefined) return 0;
    if (pa.box !== pb.box) return pa.box - pb.box;
    return pa.lastReviewedAt.getTime() - pb.lastReviewedAt.getTime();
  });

  return { nameVi: topic.nameVi, emoji: topic.emoji, words: ranked.slice(0, limit) };
}
