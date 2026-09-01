import { expect, test } from "vitest";

import {
  LESSON_TOPICS,
  LESSON_TOPIC_GROUP_ORDER,
  lessonKey,
  topicOfLesson,
} from "@/lib/lesson-topics";

/** 52 bài có thật trong repo, sinh từ `find phase_* -type d -name 'lesson_*'`.
 * Test này là cổng kiểm tra: thêm/xoá thư mục bài học mà quên cập nhật
 * taxonomy thì đỏ ở đây, chứ không phải người học phát hiện ra bài biến mất
 * khỏi lộ trình. */
const ALL_LESSON_KEYS = [
  "phase_1_foundation/lesson_01_simple_present",
  "phase_1_foundation/lesson_02_present_continuous",
  "phase_1_foundation/lesson_03_simple_past",
  "phase_1_foundation/lesson_04_simple_future",
  "phase_1_foundation/lesson_05_present_perfect",
  "phase_1_foundation/lesson_06_nouns",
  "phase_1_foundation/lesson_07_pronouns",
  "phase_1_foundation/lesson_08_adjectives",
  "phase_1_foundation/lesson_09_adverbs",
  "phase_1_foundation/lesson_10_prepositions",
  "phase_1_foundation/lesson_11_sentence_structure",
  "phase_1_foundation/lesson_12_basic_comparisons",
  "phase_1_foundation/lesson_13_question_tags",
  "phase_2_elementary/lesson_01_past_continuous",
  "phase_2_elementary/lesson_02_past_perfect",
  "phase_2_elementary/lesson_03_future_perfect_continuous",
  "phase_2_elementary/lesson_04_subject_verb_agreement",
  "phase_2_elementary/lesson_05_articles",
  "phase_2_elementary/lesson_06_modal_verbs",
  "phase_2_elementary/lesson_07_question_formation",
  "phase_2_elementary/lesson_08_conjunctions",
  "phase_2_elementary/lesson_09_basic_phrasal_verbs",
  "phase_2_elementary/lesson_10_word_formation",
  "phase_3_intermediate/lesson_01_passive_voice",
  "phase_3_intermediate/lesson_02_conditionals_type1_2",
  "phase_3_intermediate/lesson_03_conditionals_type3_mixed",
  "phase_3_intermediate/lesson_04_relative_clauses",
  "phase_3_intermediate/lesson_05_reported_speech",
  "phase_3_intermediate/lesson_06_gerunds_infinitives",
  "phase_3_intermediate/lesson_07_advanced_phrasal_verbs",
  "phase_3_intermediate/lesson_08_collocations",
  "phase_3_intermediate/lesson_09_nominalization",
  "phase_3_intermediate/lesson_10_advanced_comparisons",
  "phase_3_intermediate/lesson_11_discourse_markers",
  "phase_3_intermediate/lesson_12_awl_introduction",
  "phase_4_advanced/lesson_01_inversion",
  "phase_4_advanced/lesson_02_cleft_sentences",
  "phase_4_advanced/lesson_03_participle_clauses",
  "phase_4_advanced/lesson_04_subjunctive_mood",
  "phase_4_advanced/lesson_05_advanced_passive",
  "phase_4_advanced/lesson_06_vocabulary_nuances",
  "phase_4_advanced/lesson_07_idioms_colloquialisms",
  "phase_4_advanced/lesson_08_cohesive_devices",
  "phase_4_advanced/lesson_09_academic_essay_writing",
  "phase_4_advanced/lesson_10_awl_mastery",
  "phase_5_ielts_prep/lesson_01_writing_task1_charts",
  "phase_5_ielts_prep/lesson_02_writing_task1_maps_processes",
  "phase_5_ielts_prep/lesson_03_writing_task2_opinion_essay",
  "phase_5_ielts_prep/lesson_04_writing_task2_discussion_essay",
  "phase_5_ielts_prep/lesson_05_reading_strategies",
  "phase_5_ielts_prep/lesson_06_speaking_part1_2",
  "phase_5_ielts_prep/lesson_07_speaking_part3",
];

test("mọi bài học đều thuộc đúng MỘT chủ đề", () => {
  const seen = new Map<string, string[]>();
  for (const topic of LESSON_TOPICS) {
    for (const key of topic.lessonKeys) {
      seen.set(key, [...(seen.get(key) ?? []), topic.slug]);
    }
  }

  const missing = ALL_LESSON_KEYS.filter((k) => !seen.has(k));
  const duplicated = [...seen.entries()].filter(([, slugs]) => slugs.length > 1);
  const unknown = [...seen.keys()].filter((k) => !ALL_LESSON_KEYS.includes(k));

  expect({ missing, duplicated, unknown }).toEqual({
    missing: [],
    duplicated: [],
    unknown: [],
  });
});

test("tổng số bài trong taxonomy đúng bằng 52", () => {
  const total = LESSON_TOPICS.reduce((sum, t) => sum + t.lessonKeys.length, 0);
  expect(total).toBe(52);
});

test("slug chủ đề không trùng nhau", () => {
  const slugs = LESSON_TOPICS.map((t) => t.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
});

test("emoji không trùng nhau — thẻ chủ đề nhận diện bằng emoji", () => {
  const emojis = LESSON_TOPICS.map((t) => t.emoji);
  expect(new Set(emojis).size).toBe(emojis.length);
});

test("mọi chủ đề thuộc một nhóm hợp lệ và không nhóm nào rỗng", () => {
  for (const topic of LESSON_TOPICS) {
    expect(LESSON_TOPIC_GROUP_ORDER).toContain(topic.group);
  }
  for (const group of LESSON_TOPIC_GROUP_ORDER) {
    expect(LESSON_TOPICS.some((t) => t.group === group)).toBe(true);
  }
});

test("topicOfLesson tra ngược được, và trả null cho bài lạ", () => {
  const topic = topicOfLesson("phase_1_foundation", "lesson_01_simple_present");
  expect(topic?.slug).toBe("thi-dong-tu");
  expect(topicOfLesson("phase_9_nope", "lesson_99_nope")).toBeNull();
});

test("lessonKey ghép đúng định dạng dùng trong lessonKeys", () => {
  expect(lessonKey("phase_1_foundation", "lesson_01_simple_present")).toBe(
    "phase_1_foundation/lesson_01_simple_present",
  );
});
