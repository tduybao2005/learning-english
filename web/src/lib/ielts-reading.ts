export type ReadingPair = { passageMd: string; questionsMd: string };

/**
 * Splits an IELTS reading.md into (passage, questions) column pairs using its
 * H2 skeleton: `## READING PASSAGE n` followed by `## QUESTIONS x–y`. The
 * files are hand-written, so any test that doesn't follow the skeleton gets
 * `null` and the caller renders the original single-column markdown instead.
 */
export function splitReadingSections(
  md: string,
): { intro: string; pairs: ReadingPair[] } | null {
  const matches = [...md.matchAll(/^## +(.+)$/gm)].map((m) => ({
    index: m.index!,
    title: m[1].trim(),
  }));
  if (matches.length === 0) return null;

  const sections = matches.map((m, i) => ({
    title: m.title,
    body: md.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : md.length).trim(),
  }));

  const pairs: ReadingPair[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    if (/^reading passage/i.test(sections[i].title) && /^questions/i.test(sections[i + 1].title)) {
      pairs.push({ passageMd: sections[i].body, questionsMd: sections[i + 1].body });
    }
  }
  if (pairs.length === 0) return null;

  return { intro: md.slice(0, matches[0].index).trim(), pairs };
}

/** Một nhóm câu hỏi (`### Questions 14–18`) bên trong một bài đọc. */
export interface ReadingGroup {
  /** Số câu đầu/cuối của nhóm — khớp với `Question.number` trong DB (1..40). */
  from: number;
  to: number;
  /** Tiêu đề nhóm, ví dụ "Questions 14–18". */
  title: string;
  /**
   * Văn xuôi hướng dẫn của nhóm, ĐỨNG TRƯỚC câu hỏi đầu tiên. Bắt buộc giữ: nó
   * chứa "NO MORE THAN TWO WORDS", danh sách tiêu đề (List of Headings), khung
   * tóm tắt... Bỏ đi là người học mất thông tin buộc phải có để trả lời đúng.
   */
  instructionsMd: string;
}

export interface ReadingPassage {
  /** "READING PASSAGE 1" */
  title: string;
  /** Bài đọc: mọi thứ trước nhóm câu hỏi đầu tiên. */
  passageMd: string;
  groups: ReadingGroup[];
}

/**
 * Bóc `reading.md` thành 3 bài đọc, mỗi bài kèm các nhóm câu hỏi của nó.
 *
 * Bộ đề thật viết theo khung: `## READING PASSAGE n`, rồi các `### Questions x–y`
 * LỒNG BÊN TRONG — không phải hai H2 anh em như `splitReadingSections` giả định
 * (hàm đó vì thế trả null cho gần như mọi đề, và trang rơi về markdown một cột).
 *
 * Trả `null` nếu file không theo khung này; nơi gọi khi đó render markdown thô,
 * đúng như trước.
 */
export function splitReadingPaper(
  md: string,
): { intro: string; passages: ReadingPassage[] } | null {
  // Bộ đề có HAI khung, cả hai đều thật:
  //   (a) 17 đề: `## READING PASSAGE 1` rồi `### Questions 1–5` LỒNG bên trong;
  //   (b) 3 đề (03, 04, 29): `## READING PASSAGE 1` rồi `## QUESTIONS 1–13` NGANG HÀNG.
  // Nên quét mọi heading theo thứ tự xuất hiện thay vì giả định một khung — giả
  // định sai chính là lý do `splitReadingSections` trả null cho gần hết bộ đề.
  // Marker của một nhóm là heading (`## `/`### `) HOẶC một dòng in đậm
  // (`**Questions 7–10: ...**` — test_29 viết kiểu này, y như parser câu hỏi đã
  // phải chấp nhận từ trước).
  const headingRe = /^(?:#{2,3}\s+([^\n]+)|\*\*(Questions?[^\n*]+)\*\*\s*)$/gim;
  const heads = [...md.matchAll(headingRe)].map((m) => ({
    index: m.index!,
    end: m.index! + m[0].length,
    title: (m[1] ?? m[2]).trim(),
  }));

  const isPassage = (t: string) => /^reading passage/i.test(t);
  const questionRange = (t: string) => {
    const m = /^questions?\s+(\d+)\s*[–—-]\s*(\d+)/i.exec(t);
    return m ? { from: Number(m[1]), to: Number(m[2]) } : null;
  };

  const firstPassage = heads.findIndex((h) => isPassage(h.title));
  if (firstPassage === -1) return null;

  // Đánh dấu từng heading: bài đọc / nhóm câu hỏi / tiêu đề phụ trong bài đọc
  // (ví dụ `### The Deep Ocean` của test_12 — KHÔNG được cắt bài đọc ở đó).
  const marked = heads.map((h) => ({ ...h, passage: isPassage(h.title), range: questionRange(h.title) }));

  const passages: ReadingPassage[] = [];

  for (let i = firstPassage; i < marked.length; i++) {
    const head = marked[i];
    if (!head.passage) continue;

    const nextPassage = marked.findIndex((h, j) => j > i && h.passage);
    const spanEnd = nextPassage === -1 ? marked.length : nextPassage;

    const questionHeads = marked.slice(i + 1, spanEnd).filter((h) => h.range !== null);

    // Bài đọc chạy tới NHÓM CÂU HỎI đầu tiên (không phải heading bất kỳ), nên
    // tiêu đề phụ của bài đọc vẫn nằm trong bài đọc.
    const passageEnd =
      questionHeads.length > 0
        ? questionHeads[0].index
        : nextPassage === -1
          ? md.length
          : marked[nextPassage].index;

    // test_12/13/14... bọc các nhóm nhỏ trong một nhóm to (`## QUESTIONS 1–13`
    // chứa `### Questions 1–6`, `7–10`, `11–13`). Giữ nhóm LÁ: nhóm bao ngoài
    // không có hướng dẫn riêng, và giữ cả hai sẽ hiện câu hỏi hai lần.
    const leaves = questionHeads.filter((h, j) => {
      const next = questionHeads[j + 1];
      if (!next || !h.range || !next.range) return true;
      const wraps = next.range.from >= h.range.from && next.range.to <= h.range.to;
      return !wraps;
    });

    const groups: ReadingGroup[] = leaves.map((h) => {
      const after = marked.find((x) => x.index > h.index && (x.passage || x.range !== null));
      const end = after ? after.index : md.length;
      const body = instructionsOf(md.slice(h.end, end));
      // test_29 nhét cả hướng dẫn vào chính dòng tiêu đề ("Questions 7–10:
      // Complete the sentences... NO MORE THAN TWO WORDS"), thân nhóm đi thẳng
      // vào câu hỏi. Khi đó lấy phần sau dấu hai chấm của tiêu đề — nếu bỏ, người
      // học mất ràng buộc số từ.
      const fromTitle = h.title.includes(":") ? h.title.slice(h.title.indexOf(":") + 1).trim() : "";
      return {
        from: h.range!.from,
        to: h.range!.to,
        title: h.title,
        instructionsMd: body.length > 0 ? body : fromTitle,
      };
    });

    passages.push({
      title: head.title,
      passageMd: md.slice(head.index, passageEnd).trim(),
      groups,
    });
  }

  if (passages.every((p) => p.groups.length === 0)) return null;

  return { intro: md.slice(0, marked[firstPassage].index).trim(), passages };
}

/**
 * Phần hướng dẫn = mọi dòng trước câu hỏi đầu tiên. Câu hỏi đầu tiên là dòng mở
 * đầu bằng một số (`1.`, `**1**`, `| 1 |`) — runner render những dòng đó thành
 * câu hỏi tương tác, nên chúng không được lọt vào phần hướng dẫn.
 */
function instructionsOf(groupBody: string): string {
  const lines = groupBody.split("\n");
  const firstQuestion = lines.findIndex((line) =>
    /^\s*(?:\|\s*)?(?:\*\*)?\d+(?:\*\*)?\s*[.)|:]/.test(line),
  );
  return (firstQuestion === -1 ? lines : lines.slice(0, firstQuestion)).join("\n").trim();
}
