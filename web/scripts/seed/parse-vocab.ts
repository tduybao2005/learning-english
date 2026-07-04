export interface VocabRow {
  groupName: string;
  word: string;
  ipa: string;
  meaningVi: string;
  exampleEn: string;
}

// The curriculum's vocabulary.md tables are NOT uniform across all ~52 lessons:
// column count ranges from 3 to 6, column order varies, and some lessons omit
// an IPA and/or example column entirely (e.g. word-family grids). Instead of
// assuming a fixed column layout (word, ipa, meaning, example), we read the
// markdown table's own header row and map columns to roles by keyword, with
// the first non-index column always treated as "word". Missing roles fall
// back to "" rather than misattributing another column's data.
const IPA_RE = /ipa|phát âm|pronunciation/i;
const MEANING_RE = /nghĩa|meaning/i;
const EXAMPLE_RE = /ví dụ|example/i;
// Fallback for tables with no explicit "Ví dụ"/"Example" column, where a
// "Cách dùng" ("usage") column's cell content is itself a full example
// sentence (e.g. phase_3 lesson_10's "# | Cụm từ | Cách dùng" table: cells
// like "*X increased **compared to** Y*"). Only applied as a second pass,
// after an explicit example column, so it never shadows a table that has
// BOTH a short "Usage Notes" column and a separate real "Example Sentence"
// column (e.g. phase_5 lesson_04) — there, EXAMPLE_RE already matches
// "Example Sentence" in the strict pass, so this fallback never fires.
const EXAMPLE_FALLBACK_RE = /cách dùng|usage/i;
const INDEX_RE = /^#$|^stt$/i;
const SECTION_BREAK_RE = /bài tập|exercise/i;
const HEADING_RE = /^#{1,4}\s+(.+)$/;

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function splitCells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

interface ColumnRoles {
  word: number;
  ipa: number;
  meaning: number;
  example: number;
}

function detectColumnRoles(headerCells: string[]): ColumnRoles {
  const roles: ColumnRoles = { word: -1, ipa: -1, meaning: -1, example: -1 };
  headerCells.forEach((h, i) => {
    if (INDEX_RE.test(h)) return;
    if (roles.word === -1) { roles.word = i; return; }
    if (roles.ipa === -1 && IPA_RE.test(h)) { roles.ipa = i; return; }
    if (roles.meaning === -1 && MEANING_RE.test(h)) { roles.meaning = i; return; }
    if (roles.example === -1 && EXAMPLE_RE.test(h)) { roles.example = i; return; }
  });
  // Second pass: only if no explicit "Ví dụ"/"Example" column was found,
  // fall back to a "Cách dùng"/"Usage" column (see EXAMPLE_FALLBACK_RE).
  if (roles.example === -1) {
    headerCells.forEach((h, i) => {
      if (roles.example === -1 && i !== roles.word && i !== roles.ipa && i !== roles.meaning && EXAMPLE_FALLBACK_RE.test(h)) {
        roles.example = i;
      }
    });
  }
  return roles;
}

export function parseVocab(md: string): VocabRow[] {
  const rows: VocabRow[] = [];
  let group = "";
  let sawTable = false;
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const h = line.match(HEADING_RE);
    if (h) {
      // Some lessons' overview heading mentions "Bài tập" in passing before
      // the vocab table even starts (e.g. phase_4 lesson_07's "## Bảng tra
      // cứu & Bài tập từ vựng"). Only treat a bài-tập/exercise heading as the
      // real exercises-section boundary once we've already parsed at least
      // one vocab table, so an early false positive doesn't wipe out the
      // whole lesson's vocab.
      if (sawTable && SECTION_BREAK_RE.test(h[1])) break;
      group = h[1].trim();
      i++;
      continue;
    }

    if (isTableRow(line)) {
      // Collect the contiguous block of table lines.
      const block: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      if (block.length < 2) continue;
      const headerCells = splitCells(block[0]);
      const sepCells = splitCells(block[1]);
      if (!isSeparatorRow(sepCells)) continue; // not a real GFM table, ignore
      const roles = detectColumnRoles(headerCells);
      if (roles.word === -1) continue;
      sawTable = true;

      for (let r = 2; r < block.length; r++) {
        const cells = splitCells(block[r]);
        if (cells.length < 2) continue;
        if (isSeparatorRow(cells)) continue;
        const word = (cells[roles.word] ?? "").replace(/\*\*/g, "");
        if (!word) continue;
        rows.push({
          groupName: group,
          word,
          ipa: roles.ipa !== -1 ? (cells[roles.ipa] ?? "") : "",
          meaningVi: roles.meaning !== -1 ? (cells[roles.meaning] ?? "") : "",
          exampleEn: roles.example !== -1 ? (cells[roles.example] ?? "") : "",
        });
      }
      continue;
    }

    i++;
  }

  return rows;
}
