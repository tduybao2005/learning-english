import { describe, it, expect } from "vitest";
import { parseVocab } from "./parse-vocab";

const fixture = `# VOCABULARY - BÀI 1
## PHẦN 1: BẢNG TỪ VỰNG (60 Words)
### Nhóm A: Động từ thói quen buổi sáng (Morning Routine Verbs)
| Word | Pronunciation /IPA/ | Nghĩa tiếng Việt | Ví dụ câu |
|------|---------------------|-----------------|-----------|
| wake up | /weɪk ʌp/ | thức dậy | I **wake up** at 6 am every morning. |
| get up | /ɡet ʌp/ | ngồi dậy, rời khỏi giường | She **gets up** immediately. |
### Nhóm B: Đi làm (Commute)
| Word | Pronunciation /IPA/ | Nghĩa tiếng Việt | Ví dụ câu |
|------|---------------------|-----------------|-----------|
| commute | /kəˈmjuːt/ | đi lại | He **commutes** by motorbike. |
`;

describe("parseVocab", () => {
  it("extracts rows grouped by Nhóm heading", () => {
    const words = parseVocab(fixture);
    expect(words).toHaveLength(3);
    expect(words[0]).toEqual({
      groupName: "Nhóm A: Động từ thói quen buổi sáng (Morning Routine Verbs)",
      word: "wake up", ipa: "/weɪk ʌp/", meaningVi: "thức dậy",
      exampleEn: "I **wake up** at 6 am every morning.",
    });
    expect(words[2].groupName).toContain("Nhóm B");
  });
  it("skips separator and header rows", () => {
    expect(parseVocab(fixture).some(w => w.word.includes("---"))).toBe(false);
  });
});

// The real corpus (52 lesson vocabulary.md files) does NOT use a uniform
// 4-column [Word | IPA | Nghĩa | Ví dụ] table. Column count ranges 3-6,
// order varies, and some lessons omit an IPA and/or example column
// entirely. These cases reproduce real formats found while spot-checking
// all phases, to justify header-driven column-role detection instead of a
// fixed cells[0..3] mapping.
describe("parseVocab: real-corpus format variations", () => {
  it("handles a leading '#' index column (phase_1 lesson_07/08/09/10 style)", () => {
    const md = `### Nhóm A
| # | Word | Pronunciation /IPA/ | Nghĩa tiếng Việt | Ví dụ câu |
|---|------|---------------------|-----------------|-----------|
| 1 | this | /ðɪs/ | cái này | **This** is my book. |
`;
    expect(parseVocab(md)).toEqual([
      { groupName: "Nhóm A", word: "this", ipa: "/ðɪs/", meaningVi: "cái này", exampleEn: "**This** is my book." },
    ]);
  });

  it("falls back to empty ipa when the table has no IPA column (e.g. phase_4 lesson_06 vocabulary_nuances)", () => {
    const md = `### TÍNH CÁCH
| Từ | Nghĩa | Connotation | Ví dụ |
|---|---|---|---|
| steadfast | kiên định vững vàng | Positive | She remained steadfast. |
`;
    expect(parseVocab(md)).toEqual([
      { groupName: "TÍNH CÁCH", word: "steadfast", ipa: "", meaningVi: "kiên định vững vàng", exampleEn: "She remained steadfast." },
    ]);
  });

  it("falls back to empty meaning/example when a table is a pure word-family grid with no such columns (phase_2 lesson_10 word_formation)", () => {
    const md = `### Word families
| Gốc | Danh từ | Động từ | Tính từ | Trạng từ |
|---|---|---|---|---|
| act | action | act | active | actively |
`;
    expect(parseVocab(md)).toEqual([
      { groupName: "Word families", word: "act", ipa: "", meaningVi: "", exampleEn: "" },
    ]);
  });

  it("stops at the first 'Bài tập' / 'Exercise' heading and ignores tables after it", () => {
    const md = `### Nhóm A
| Word | /IPA/ | Nghĩa | Ví dụ |
|---|---|---|---|
| go | /ɡəʊ/ | đi | I go. |
## PHẦN 2: BÀI TẬP TỪ VỰNG
### Bài tập 1: Nối từ với nghĩa
| Cột A | Cột B |
|---|---|
| 1. go | a. đi |
`;
    const words = parseVocab(md);
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("go");
  });

  it("ignores a 'Bài tập' mention in the overview heading before any table has appeared (phase_4 lesson_07 idioms style)", () => {
    const md = `# BÀI 7: VOCABULARY — IDIOMS
## Bảng tra cứu & Bài tập từ vựng
## BẢNG IDIOMS ĐẦY ĐỦ
| # | Idiom | Nghĩa | Ví dụ |
|---|---|---|---|
| 1 | kill time | giết thời gian | I read to kill time. |
## BÀI TẬP 1: GHÉP NGHĨA
| Cột A | Cột B |
|---|---|
| 1. kill time | a. giết thời gian |
`;
    const words = parseVocab(md);
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("kill time");
  });

  it("falls back to a 'Cách dùng' column as the example when no explicit Ví dụ/Example column exists (phase_3 lesson_10 chart-language style)", () => {
    const md = `### Ngôn ngữ mô tả biểu đồ
| # | Cụm từ | Cách dùng |
|---|---|---|
| 39 | compared to/with | *X increased **compared to** Y* |
`;
    const words = parseVocab(md);
    expect(words).toEqual([
      { groupName: "Ngôn ngữ mô tả biểu đồ", word: "compared to/with", ipa: "", meaningVi: "", exampleEn: "*X increased **compared to** Y*" },
    ]);
  });

  it("does NOT let a 'Usage Notes' column shadow a separate real 'Example Sentence' column (phase_5 lesson_04 style)", () => {
    const md = `### Presenting View A
| Phrase | Essay Type | Usage Notes | Example Sentence |
|---|---|---|---|
| Proponents argue that... | Discussion | Formal; introduces View A | Proponents argue that stricter controls are essential. |
`;
    const words = parseVocab(md);
    expect(words).toHaveLength(1);
    expect(words[0].exampleEn).toBe("Proponents argue that stricter controls are essential.");
    expect(words[0].exampleEn).not.toContain("Formal; introduces");
  });
});
