/**
 * Taxonomy 52 bài học → 15 chủ đề, cho trang Lộ trình duyệt theo CHỦ ĐỀ thay
 * vì theo giai đoạn.
 *
 * Vì sao là hằng số TypeScript chứ không phải bảng trong DB như
 * `vocab_topics/`: bảng này chỉ 52 dòng và gần như không đổi (nó đổi khi và
 * chỉ khi có bài học mới), trong khi con đường TSV → seed → Postgres đã một
 * lần quét sạch `topicId` của cả kho từ vựng vì image thiếu file nguồn. Giữ
 * ở đây thì không có migration, không có bước seed, không có dòng COPY nào
 * để quên — và `lesson-topics.test.ts` là cổng kiểm tra chạy trong mọi lần
 * `npm test`.
 *
 * Thứ tự trong `lessonKeys` là thứ tự học ĐỀ XUẤT của chủ đề (dễ → khó),
 * không phải thứ tự giai đoạn. Ví dụ "Câu bị động" đi từ bài Giai đoạn 3 rồi
 * mới tới bài Giai đoạn 4.
 */

export type LessonTopicGroup = "CORE" | "ADVANCED" | "VOCAB" | "IELTS";

export const LESSON_TOPIC_GROUP_LABELS: Record<LessonTopicGroup, string> = {
  CORE: "Ngữ pháp nền tảng",
  ADVANCED: "Ngữ pháp nâng cao",
  VOCAB: "Từ vựng & diễn đạt",
  IELTS: "Kỹ năng IELTS",
};

export const LESSON_TOPIC_GROUP_ORDER: readonly LessonTopicGroup[] = [
  "CORE",
  "ADVANCED",
  "VOCAB",
  "IELTS",
];

export interface LessonTopicDef {
  slug: string;
  nameVi: string;
  nameEn: string;
  emoji: string;
  group: LessonTopicGroup;
  /** Một câu mô tả, hiện trên thẻ hub và dưới tên ở trang chi tiết. */
  description: string;
  /** "<phaseSlug>/<lessonSlug>", theo thứ tự học đề xuất trong chủ đề. */
  lessonKeys: string[];
}

export const LESSON_TOPICS: readonly LessonTopicDef[] = [
  {
    slug: "thi-dong-tu",
    nameVi: "Thì động từ",
    nameEn: "Verb tenses",
    emoji: "🕐",
    group: "CORE",
    description: "Tám thì cơ bản: hiện tại, quá khứ, tương lai và các dạng hoàn thành.",
    lessonKeys: [
      "phase_1_foundation/lesson_01_simple_present",
      "phase_1_foundation/lesson_02_present_continuous",
      "phase_1_foundation/lesson_03_simple_past",
      "phase_1_foundation/lesson_04_simple_future",
      "phase_1_foundation/lesson_05_present_perfect",
      "phase_2_elementary/lesson_01_past_continuous",
      "phase_2_elementary/lesson_02_past_perfect",
      "phase_2_elementary/lesson_03_future_perfect_continuous",
    ],
  },
  {
    slug: "tu-loai-mao-tu",
    nameVi: "Từ loại & mạo từ",
    nameEn: "Parts of speech & articles",
    emoji: "🔤",
    group: "CORE",
    description: "Danh từ, đại từ, tính từ, trạng từ, giới từ và a/an/the.",
    lessonKeys: [
      "phase_1_foundation/lesson_06_nouns",
      "phase_1_foundation/lesson_07_pronouns",
      "phase_1_foundation/lesson_08_adjectives",
      "phase_1_foundation/lesson_09_adverbs",
      "phase_1_foundation/lesson_10_prepositions",
      "phase_2_elementary/lesson_05_articles",
    ],
  },
  {
    slug: "cau-truc-cau",
    nameVi: "Cấu trúc câu & câu hỏi",
    nameEn: "Sentence structure & questions",
    emoji: "📐",
    group: "CORE",
    description: "Dựng câu đúng, hoà hợp chủ ngữ–động từ, đặt câu hỏi và nối câu.",
    lessonKeys: [
      "phase_1_foundation/lesson_11_sentence_structure",
      "phase_2_elementary/lesson_04_subject_verb_agreement",
      "phase_2_elementary/lesson_07_question_formation",
      "phase_1_foundation/lesson_13_question_tags",
      "phase_2_elementary/lesson_08_conjunctions",
    ],
  },
  {
    slug: "so-sanh",
    nameVi: "So sánh & đối chiếu",
    nameEn: "Comparisons",
    emoji: "⚖️",
    group: "CORE",
    description: "Từ so sánh hơn/nhất cơ bản tới các cấu trúc so sánh nâng cao.",
    lessonKeys: [
      "phase_1_foundation/lesson_12_basic_comparisons",
      "phase_3_intermediate/lesson_10_advanced_comparisons",
    ],
  },
  {
    slug: "menh-de",
    nameVi: "Mệnh đề & câu phức",
    nameEn: "Clauses",
    emoji: "🔗",
    group: "ADVANCED",
    description: "Mệnh đề quan hệ, câu tường thuật và mệnh đề phân từ.",
    lessonKeys: [
      "phase_3_intermediate/lesson_04_relative_clauses",
      "phase_3_intermediate/lesson_05_reported_speech",
      "phase_4_advanced/lesson_03_participle_clauses",
    ],
  },
  {
    slug: "dieu-kien-gia-dinh",
    nameVi: "Câu điều kiện & giả định",
    nameEn: "Conditionals & subjunctive",
    emoji: "🔮",
    group: "ADVANCED",
    description: "Ba loại câu điều kiện, câu điều kiện hỗn hợp và thức giả định.",
    lessonKeys: [
      "phase_3_intermediate/lesson_02_conditionals_type1_2",
      "phase_3_intermediate/lesson_03_conditionals_type3_mixed",
      "phase_4_advanced/lesson_04_subjunctive_mood",
    ],
  },
  {
    slug: "cau-bi-dong",
    nameVi: "Câu bị động",
    nameEn: "Passive voice",
    emoji: "🔄",
    group: "ADVANCED",
    description: "Từ bị động cơ bản tới bị động kép và bị động phi ngôi.",
    lessonKeys: [
      "phase_3_intermediate/lesson_01_passive_voice",
      "phase_4_advanced/lesson_05_advanced_passive",
    ],
  },
  {
    slug: "dang-dong-tu",
    nameVi: "Động từ khuyết thiếu & dạng động từ",
    nameEn: "Modals, gerunds & infinitives",
    emoji: "🎚️",
    group: "ADVANCED",
    description: "Can/must/should và cách chọn giữa V-ing với to-V.",
    lessonKeys: [
      "phase_2_elementary/lesson_06_modal_verbs",
      "phase_3_intermediate/lesson_06_gerunds_infinitives",
    ],
  },
  {
    slug: "nhan-manh",
    nameVi: "Cấu trúc nhấn mạnh",
    nameEn: "Emphatic structures",
    emoji: "✨",
    group: "ADVANCED",
    description: "Đảo ngữ và câu chẻ — hai công cụ nâng band Writing rõ rệt nhất.",
    lessonKeys: [
      "phase_4_advanced/lesson_01_inversion",
      "phase_4_advanced/lesson_02_cleft_sentences",
    ],
  },
  {
    slug: "cum-dong-tu-thanh-ngu",
    nameVi: "Cụm động từ & thành ngữ",
    nameEn: "Phrasal verbs & idioms",
    emoji: "💬",
    group: "VOCAB",
    description: "Phrasal verb cơ bản tới nâng cao, cùng thành ngữ và khẩu ngữ.",
    lessonKeys: [
      "phase_2_elementary/lesson_09_basic_phrasal_verbs",
      "phase_3_intermediate/lesson_07_advanced_phrasal_verbs",
      "phase_4_advanced/lesson_07_idioms_colloquialisms",
    ],
  },
  {
    slug: "xay-dung-von-tu",
    nameVi: "Xây dựng vốn từ",
    nameEn: "Vocabulary building",
    emoji: "📚",
    group: "VOCAB",
    description: "Họ từ, collocation, danh hoá, sắc thái nghĩa và Academic Word List.",
    lessonKeys: [
      "phase_2_elementary/lesson_10_word_formation",
      "phase_3_intermediate/lesson_08_collocations",
      "phase_3_intermediate/lesson_09_nominalization",
      "phase_4_advanced/lesson_06_vocabulary_nuances",
      "phase_3_intermediate/lesson_12_awl_introduction",
      "phase_4_advanced/lesson_10_awl_mastery",
    ],
  },
  {
    slug: "lien-ket-mach-van",
    nameVi: "Liên kết & mạch văn",
    nameEn: "Cohesion & discourse",
    emoji: "🧵",
    group: "VOCAB",
    description: "Từ nối và phương tiện liên kết để bài viết đọc liền mạch.",
    lessonKeys: [
      "phase_3_intermediate/lesson_11_discourse_markers",
      "phase_4_advanced/lesson_08_cohesive_devices",
    ],
  },
  {
    slug: "viet-hoc-thuat",
    nameVi: "Viết học thuật & IELTS Writing",
    nameEn: "Academic & IELTS writing",
    emoji: "📝",
    group: "IELTS",
    description: "Bố cục bài luận học thuật, Task 1 biểu đồ/bản đồ và Task 2.",
    lessonKeys: [
      "phase_4_advanced/lesson_09_academic_essay_writing",
      "phase_5_ielts_prep/lesson_01_writing_task1_charts",
      "phase_5_ielts_prep/lesson_02_writing_task1_maps_processes",
      "phase_5_ielts_prep/lesson_03_writing_task2_opinion_essay",
      "phase_5_ielts_prep/lesson_04_writing_task2_discussion_essay",
    ],
  },
  {
    slug: "ielts-reading",
    nameVi: "Chiến lược IELTS Reading",
    nameEn: "IELTS reading strategies",
    emoji: "📖",
    group: "IELTS",
    description: "Skimming, scanning và cách xử lý từng dạng câu hỏi Reading.",
    lessonKeys: ["phase_5_ielts_prep/lesson_05_reading_strategies"],
  },
  {
    slug: "ielts-speaking",
    nameVi: "IELTS Speaking",
    nameEn: "IELTS speaking",
    emoji: "🎤",
    group: "IELTS",
    description: "Part 1, 2 và 3 — cách triển khai ý và giữ độ trôi chảy.",
    lessonKeys: [
      "phase_5_ielts_prep/lesson_06_speaking_part1_2",
      "phase_5_ielts_prep/lesson_07_speaking_part3",
    ],
  },
];

export function lessonKey(phaseSlug: string, lessonSlug: string): string {
  return `${phaseSlug}/${lessonSlug}`;
}

/** Tra ngược một bài về chủ đề của nó. Trả `null` cho bài chưa được xếp —
 * `lesson-topics.test.ts` đảm bảo trường hợp đó không tồn tại trong repo,
 * nhưng nơi gọi vẫn phải chịu được `null` vì DB có thể đi trước Markdown. */
export function topicOfLesson(phaseSlug: string, lessonSlug: string): LessonTopicDef | null {
  const key = lessonKey(phaseSlug, lessonSlug);
  return LESSON_TOPICS.find((t) => t.lessonKeys.includes(key)) ?? null;
}
