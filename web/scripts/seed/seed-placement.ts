import fs from "fs";
import path from "path";

import { db } from "../../src/lib/db";
import { normalize } from "../../src/lib/grading/normalize";
import type { BandTableRow } from "../../src/lib/band";
import { stripFrontmatter } from "./strip-frontmatter";

/**
 * Seeds the `default` `PlacementTest` row from
 * `ielts_practice_tests/test_01/{reading.md,writing.md,answer_key.md}`.
 *
 * ## Why this does NOT reuse `parseExercise` for the reading questions
 *
 * `parseExercise` (Task 4) is built around a specific corpus convention (a
 * body of `## SECTION X` / `## PHẦN X` headings followed by a matching
 * `## ANSWER KEY` block on marker lines like `1.`/`**A1.**`). `reading.md`
 * doesn't have that shape at all — it has no answer key section of its own
 * (its questions end with "END OF TEST 01 — READING"), its "blanks" use
 * `..........` (dots) not `______`, and its MCQ options are `- **A** text`
 * (bold letter, no `.`/`)` delimiter) rather than `- A) text`. Forcing these
 * through `parseExercise`'s regex-driven inference would need several
 * preprocessing hacks for a corpus of exactly one file.
 *
 * More importantly: `answer_key.md`'s own per-question Reading answer
 * table (Q1-40) was checked question-by-question against the actual
 * `reading.md` passage text while implementing this task, and it does NOT
 * match — e.g. its Q2 explanation talks about "adults need 7-9 hours" and
 * marks Q2 FALSE, but `reading.md`'s real Q2 ("voluntary muscles ...
 * temporarily paralysed to prevent acting out dreams") is explicitly TRUE
 * per paragraph B; Q14-18 is labelled "True/False/Not Given" in
 * `answer_key.md` but `reading.md`'s real Q14-18 is a heading-matching
 * task. The per-question answer table in `answer_key.md` is boilerplate
 * left over from the test-bank's generation process, not hand-verified
 * against this specific passage. Since placement correctness determines a
 * new learner's starting phase, the question/answer data below is instead
 * hand-derived directly from `reading.md`'s own passage text (each answer
 * traceable to an explicit sentence, cited in comments) rather than parsed
 * from a key that was found to be wrong for this file.
 *
 * What IS reused: the general "find heading -> slice to next heading"
 * boundary technique from Task 4/12 (`sliceBetween` below), `normalize()`
 * for building `AnswerVariant.normalized` (same helper `parseExercise`
 * itself uses), and the `Section`/`Question`/`AnswerVariant` nested-create
 * shape (matching `seedListeningSets` and the lesson exercise seed in
 * `ingest.ts`).
 *
 * What IS parsed programmatically from the source files (both are
 * mechanically reliable, unlike the per-question answer table above):
 *  - `readingMd`: Passages 1-2's title+paragraph prose, sliced out of
 *    `reading.md` by heading boundaries (no hand-copying).
 *  - `writingPromptMd`: Writing Task 2's prompt, sliced out of
 *    `writing.md` between its own heading and the `### Model Answer`
 *    heading (so the model answer/examiner notes never reach the
 *    PlacementTest row).
 *  - `bandTable`: the "Bảng Quy Đổi Điểm — Reading Band Score" markdown
 *    table in `answer_key.md` — a generic raw-score->band conversion table
 *    unrelated to this specific passage's content, so (unlike the
 *    per-question key) there's no correctness concern parsing it directly.
 */

// Same convention as `ingest.ts`: resolved relative to the invocation cwd
// (expected to be `web/`, matching the `npm run seed:placement` script),
// not `__dirname` — keeps both seed scripts consistent.
const REPO_ROOT = path.resolve(process.cwd(), "..");
const TEST01_DIR = path.join(REPO_ROOT, "ielts_practice_tests", "test_01");
const PLACEMENT_SLUG = "default";
const LISTENING_SLUG = "placement_01";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function mkVariant(text: string): { text: string; normalized: string } {
  return { text, normalized: normalize(text) };
}

/** Slices `md` from the line matching `startRe` (heading included) up to
 * (but excluding) the next line matching `endRe`, or EOF if `endRe` never
 * matches again after `startRe`. Same boundary-finding technique as Task
 * 4/12's heading-based section splitting, just for two arbitrary markers
 * instead of a generic heading grammar (this file's headings are fixed and
 * known in advance, so a full heading parser is unnecessary). */
function sliceBetween(md: string, startRe: RegExp, endRe: RegExp): string {
  const startM = startRe.exec(md);
  if (!startM) throw new Error(`sliceBetween: start marker not found (${startRe})`);
  const rest = md.slice(startM.index);
  const endM = endRe.exec(rest.slice(startM[0].length));
  const endIndex = endM ? startM[0].length + endM.index : rest.length;
  return rest.slice(0, endIndex).trim();
}

// ---------------------------------------------------------------------------
// readingMd: Passages 1-2 prose only (no question blocks)
// ---------------------------------------------------------------------------

function extractReadingMd(readingMd: string): string {
  const passage1 = sliceBetween(
    readingMd,
    /^## READING PASSAGE 1$/m,
    /^## QUESTIONS 1[–\-]13$/m,
  );
  const passage2 = sliceBetween(
    readingMd,
    /^## READING PASSAGE 2$/m,
    /^## QUESTIONS 14[–\-]26$/m,
  );
  return `${passage1}\n\n---\n\n${passage2}`;
}

// ---------------------------------------------------------------------------
// writingPromptMd: Task 2 prompt only (no model answer / examiner notes)
// ---------------------------------------------------------------------------

function extractWritingPromptMd(writingMd: string): string {
  return sliceBetween(writingMd, /^## WRITING TASK 2$/m, /^### Model Answer/m);
}

// ---------------------------------------------------------------------------
// bandTable: parse the "Bảng Quy Đổi Điểm — Reading Band Score" table
// ---------------------------------------------------------------------------

function extractBandTable(answerKeyMd: string): BandTableRow[] {
  const block = sliceBetween(
    answerKeyMd,
    /^## Bảng Quy Đổi Điểm/m,
    /^## PHẦN VIẾT/m,
  );
  const rows: BandTableRow[] = [];
  const rowRe = /^\|\s*(\d+)(?:\s*[–\-]\s*\d+)?\s*\|\s*([\d.]+)\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(block))) {
    const min = parseInt(m[1], 10);
    const band = parseFloat(m[2]);
    if (Number.isFinite(min) && Number.isFinite(band)) rows.push({ min, band });
  }
  if (rows.length === 0) throw new Error("extractBandTable: no rows parsed from answer_key.md");
  return rows.sort((a, b) => a.min - b.min);
}

// ---------------------------------------------------------------------------
// Reading questions: hand-derived directly from reading.md's passage text
// (see file-level docstring for why this isn't parsed from answer_key.md).
// Each `answerRaw`/variant is cited against the exact passage sentence it
// comes from.
// ---------------------------------------------------------------------------

type ReadingSectionKind = "FILL_BLANK" | "MULTIPLE_CHOICE";

interface ReadingQuestionSeed {
  number: number;
  prompt: string;
  options: { label: string; text: string }[] | null;
  answerRaw: string;
  keyNote: string | null;
  variants: { text: string; normalized: string }[];
}

interface ReadingSectionSeed {
  label: string;
  title: string;
  kind: ReadingSectionKind;
  instructions: string | null;
  questions: ReadingQuestionSeed[];
}

const TRUE_FALSE_OPTIONS = [
  { label: "TRUE", text: "Đúng (True)" },
  { label: "FALSE", text: "Sai (False)" },
  { label: "NOT GIVEN", text: "Không có thông tin (Not Given)" },
];

function tfVariant(answer: "TRUE" | "FALSE" | "NOT GIVEN"): { text: string; normalized: string }[] {
  return [mkVariant(answer)];
}

const HEADING_OPTIONS = [
  { label: "i", text: "Coffee's arrival in Europe and the birth of the coffeehouse culture" },
  { label: "ii", text: "Trade, conquest, and colonial plantation labour" },
  { label: "iii", text: "The legendary African origins of the coffee plant" },
  { label: "iv", text: "Religious authorities attempt to suppress the coffee trade" },
  { label: "v", text: "The Arabian Peninsula as the birthplace of commercial coffee culture" },
  { label: "vi", text: "Coffee's expansion through the Ottoman Empire" },
  { label: "vii", text: "How coffeehouses shaped European commerce and finance" },
  { label: "viii", text: "The modern fair trade movement and climate threats" },
  { label: "ix", text: "Scientific studies into coffee's health benefits" },
  { label: "x", text: "Coffee's roots in Ethiopian agriculture and early consumption" },
];

function mcVariant(label: string, options: { label: string; text: string }[]): { text: string; normalized: string }[] {
  const opt = options.find((o) => o.label === label);
  const variants = [mkVariant(label)];
  if (opt) variants.push(mkVariant(opt.text));
  return variants;
}

function buildReadingSections(): ReadingSectionSeed[] {
  return [
    // --- Passage 1: The Science of Sleep --------------------------------
    {
      label: "A",
      title: "Questions 1–5",
      kind: "MULTIPLE_CHOICE",
      instructions:
        "Do the following statements agree with the information given in Reading Passage 1? Write TRUE / FALSE / NOT GIVEN.",
      questions: [
        {
          // Paragraph B: "[sleep spindles] are believed to play a central
          // role in the consolidation of procedural memory"
          number: 1,
          prompt: "Stage 2 of NREM sleep is thought to contribute to the consolidation of procedural memory.",
          options: TRUE_FALSE_OPTIONS,
          answerRaw: "TRUE",
          keyNote: "Paragraph B: sleep spindles are believed to play a central role in consolidating procedural memory.",
          variants: tfVariant("TRUE"),
        },
        {
          // Paragraph B: "voluntary muscles are temporarily paralysed ...
          // preventing the sleeper from physically acting out their dreams"
          number: 2,
          prompt:
            "During REM sleep, the voluntary muscles of the body are temporarily paralysed to prevent sleepers from acting out their dreams.",
          options: TRUE_FALSE_OPTIONS,
          answerRaw: "TRUE",
          keyNote: "Paragraph B describes REM atonia in exactly these terms.",
          variants: tfVariant("TRUE"),
        },
        {
          // Paragraph C: "approximately twenty-four hours" + "calibrated by
          // environmental cues" contradicts "exactly ... under all conditions"
          number: 3,
          prompt: "The natural human circadian cycle lasts exactly twenty-four hours under all conditions.",
          options: TRUE_FALSE_OPTIONS,
          answerRaw: "FALSE",
          keyNote:
            "Paragraph C says the cycle is 'approximately' 24 hours and is calibrated by external light cues — not exact or condition-independent.",
          variants: tfVariant("FALSE"),
        },
        {
          // Paragraph D: "A landmark study published in ... Science in
          // 2013 ... glymphatic system ... flushing out toxic metabolic
          // waste products including beta-amyloid"
          number: 4,
          prompt:
            "Research published in Science in 2013 linked the brain's glymphatic system to the removal of waste products including beta-amyloid.",
          options: TRUE_FALSE_OPTIONS,
          answerRaw: "TRUE",
          keyNote: "Paragraph D states this directly.",
          variants: tfVariant("TRUE"),
        },
        {
          // Passage links OSA to obesity (paragraph F) but never mentions
          // REM/nightmares in connection with OSA.
          number: 5,
          prompt:
            "People who suffer from obstructive sleep apnoea are more likely than others to experience vivid nightmares during REM sleep.",
          options: TRUE_FALSE_OPTIONS,
          answerRaw: "NOT GIVEN",
          keyNote: "Paragraph F links OSA to obesity, but the passage never discusses OSA and REM nightmares.",
          variants: tfVariant("NOT GIVEN"),
        },
      ],
    },
    {
      label: "B",
      title: "Questions 6–10",
      kind: "FILL_BLANK",
      instructions: "Answer the questions below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
      questions: [
        {
          // Paragraph C: "the suprachiasmatic nucleus (SCN) in the
          // hypothalamus, the brain region that functions as the master
          // pacemaker of circadian timing"
          number: 6,
          prompt:
            "What is the name of the brain region that serves as the master pacemaker of the body's circadian timing system?",
          options: null,
          answerRaw: "suprachiasmatic nucleus (SCN)",
          keyNote: "Paragraph C.",
          variants: [mkVariant("suprachiasmatic nucleus"), mkVariant("SCN")],
        },
        {
          // Paragraph C: "blue-spectrum wavelengths emitted by
          // smartphones and computer screens"
          number: 7,
          prompt:
            "What specific type of light emitted by electronic devices is described as being most disruptive to melatonin production?",
          options: null,
          answerRaw: "blue-spectrum wavelengths",
          keyNote: "Paragraph C.",
          variants: [mkVariant("blue-spectrum wavelengths"), mkVariant("blue light"), mkVariant("blue spectrum wavelengths")],
        },
        {
          // Paragraph F: OSA "is strongly correlated with obesity"
          number: 8,
          prompt: "What medical condition is identified in the passage as being strongly correlated with obstructive sleep apnoea?",
          options: null,
          answerRaw: "obesity",
          keyNote: "Paragraph F.",
          variants: [mkVariant("obesity")],
        },
        {
          // Paragraph B: "individuals may experience hypnic jerks —
          // sudden involuntary muscular contractions"
          number: 9,
          prompt:
            "What is the name given to the involuntary muscular contractions that can occur during Stage 1 of NREM sleep?",
          options: null,
          answerRaw: "hypnic jerks",
          keyNote: "Paragraph B.",
          variants: [mkVariant("hypnic jerks")],
        },
        {
          // Paragraph E: "Health authorities including the American
          // Academy of Sleep Medicine and the World Health Organisation
          // recommend ..."
          number: 10,
          prompt:
            "According to the passage, which organisation alongside the World Health Organisation recommends that adults obtain seven to nine hours of sleep per night?",
          options: null,
          answerRaw: "American Academy of Sleep Medicine",
          keyNote: "Paragraph E.",
          variants: [mkVariant("American Academy of Sleep Medicine"), mkVariant("the American Academy of Sleep Medicine")],
        },
      ],
    },
    {
      label: "C",
      title: "Questions 11–13",
      kind: "FILL_BLANK",
      instructions:
        "Complete the sentences below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from the passage for each answer.",
      questions: [
        {
          // Paragraph B: "A full sleep cycle lasts approximately ninety minutes"
          number: 11,
          prompt: "A complete sleep cycle lasts approximately ______ minutes from start to finish.",
          options: null,
          answerRaw: "ninety (90)",
          keyNote: "Paragraph B.",
          variants: [mkVariant("ninety"), mkVariant("90")],
        },
        {
          // Paragraph B: "growth hormone is secreted by the pituitary gland"
          number: 12,
          prompt: "During slow-wave sleep, the pituitary gland secretes ______ , which supports physical repair and growth.",
          options: null,
          answerRaw: "growth hormone",
          keyNote: "Paragraph B.",
          variants: [mkVariant("growth hormone")],
        },
        {
          // Paragraph F: "estimated by the RAND Corporation at over four
          // hundred billion dollars annually"
          number: 13,
          prompt:
            "The RAND Corporation estimated that sleep disorders cost the United States over ______ dollars every year in lost productivity and related expenses.",
          options: null,
          answerRaw: "four hundred billion (400 billion)",
          keyNote: "Paragraph F.",
          variants: [mkVariant("four hundred billion"), mkVariant("400 billion"), mkVariant("four hundred billion dollars")],
        },
      ],
    },
    // --- Passage 2: Beans of Empire — coffee trade ----------------------
    {
      label: "D",
      title: "Questions 14–18",
      kind: "MULTIPLE_CHOICE",
      instructions:
        "Reading Passage 2 has seven paragraphs, A–G. Choose the correct heading for paragraphs B–F from the list of headings.",
      questions: [
        {
          // Paragraph B: Ethiopian origins, Kaldi legend, early
          // consumption (raw/energy balls/qishr) — best matches "x", a
          // more comprehensive match than "iii" (legend only).
          number: 14,
          prompt: "Paragraph B",
          options: HEADING_OPTIONS,
          answerRaw: "x",
          keyNote: "Paragraph B covers Ethiopian cultivation AND early consumption forms, not just the Kaldi legend.",
          variants: mcVariant("x", HEADING_OPTIONS),
        },
        {
          // Paragraph C: Red Sea trade -> Mocha (Yemen) as first
          // commercial coffee centre.
          number: 15,
          prompt: "Paragraph C",
          options: HEADING_OPTIONS,
          answerRaw: "v",
          keyNote: "Paragraph C: Mocha, Yemen becomes the first major centre of coffee commerce.",
          variants: mcVariant("v", HEADING_OPTIONS),
        },
        {
          // Paragraph D: majority of the paragraph (3 of 5 sentences)
          // covers Constantinople + spread through Ottoman territories;
          // the Europe/Church material is secondary.
          number: 16,
          prompt: "Paragraph D",
          options: HEADING_OPTIONS,
          answerRaw: "vi",
          keyNote: "Paragraph D's dominant theme is coffee's spread through Ottoman territories.",
          variants: mcVariant("vi", HEADING_OPTIONS),
        },
        {
          // Paragraph E: Lloyd's of London / Jonathan's Coffee House ->
          // Stock Exchange, explicitly "a direct role in the development
          // of modern financial institutions."
          number: 17,
          prompt: "Paragraph E",
          options: HEADING_OPTIONS,
          answerRaw: "vii",
          keyNote: "Paragraph E is specifically about coffeehouses and finance/commerce.",
          variants: mcVariant("vii", HEADING_OPTIONS),
        },
        {
          // Paragraph F: Dutch/French/Brazilian colonial plantation
          // expansion, built on enslaved labour.
          number: 18,
          prompt: "Paragraph F",
          options: HEADING_OPTIONS,
          answerRaw: "ii",
          keyNote: "Paragraph F covers colonial plantation expansion and enslaved labour.",
          variants: mcVariant("ii", HEADING_OPTIONS),
        },
      ],
    },
    {
      label: "E",
      title: "Questions 19–22",
      kind: "MULTIPLE_CHOICE",
      instructions: "Choose the correct letter, A, B, C or D.",
      questions: [
        {
          // Paragraph B: "berries and leaves were often eaten raw, mixed
          // with animal fat into portable energy balls, or brewed into a
          // fermented alcoholic drink"
          number: 19,
          prompt: "According to the passage, in what form was coffee most commonly consumed in early Ethiopia?",
          options: [
            { label: "A", text: "Brewed as a hot liquid similar to modern coffee" },
            { label: "B", text: "Eaten raw or mixed with fat, or fermented into an alcoholic drink" },
            { label: "C", text: "Ground into a powder and dissolved in cold water" },
            { label: "D", text: "Dried and smoked as part of religious ceremonies" },
          ],
          answerRaw: "B",
          keyNote: "Paragraph B.",
          variants: mcVariant("B", [{ label: "B", text: "Eaten raw or mixed with fat, or fermented into an alcoholic drink" }]),
        },
        {
          // Paragraph C: "alarmed by the political discussions ... on the
          // grounds that they encouraged seditious conversation"
          number: 20,
          prompt: "Why did the Governor of Mecca attempt to ban coffeehouses in 1511?",
          options: [
            { label: "A", text: "He believed coffee was harmful to physical health." },
            { label: "B", text: "He objected to the religious nature of conversations held there." },
            { label: "C", text: "He was concerned that political discussions in coffeehouses were dangerous." },
            { label: "D", text: "He wanted to protect the economic interests of local tea merchants." },
          ],
          answerRaw: "C",
          keyNote: "Paragraph C.",
          variants: mcVariant("C", [{ label: "C", text: "He was concerned that political discussions in coffeehouses were dangerous." }]),
        },
        {
          // Paragraph E: "Coffeehouses thus played a direct role in the
          // development of modern financial institutions."
          number: 21,
          prompt: "What was the significance of Lloyd's of London's origins in a coffeehouse?",
          options: [
            { label: "A", text: "It demonstrated that coffeehouses functioned as informal universities." },
            { label: "B", text: "It showed that coffeehouses played a direct role in the development of modern financial institutions." },
            { label: "C", text: "It illustrated how coffeehouses competed directly with taverns for customers." },
            { label: "D", text: "It proved that coffee consumption increased productivity in commercial settings." },
          ],
          answerRaw: "B",
          keyNote: "Paragraph E.",
          variants: mcVariant("B", [{ label: "B", text: "It showed that coffeehouses played a direct role in the development of modern financial institutions." }]),
        },
        {
          // Paragraph F: Francisco de Melo Palheta charmed the Governor
          // of French Guiana's wife into providing seedlings.
          number: 22,
          prompt: "According to paragraph F, how did Brazil first obtain its coffee plants?",
          options: [
            { label: "A", text: "They were purchased officially from Dutch colonial authorities." },
            { label: "B", text: "They were obtained through an arrangement involving coffee seedlings provided by a French Guianan official's wife." },
            { label: "C", text: "They arrived via slave traders who brought them from Africa." },
            { label: "D", text: "They were developed through independent cross-breeding experiments by Brazilian scientists." },
          ],
          answerRaw: "B",
          keyNote: "Paragraph F.",
          variants: mcVariant("B", [{ label: "B", text: "They were obtained through an arrangement involving coffee seedlings provided by a French Guianan official's wife." }]),
        },
      ],
    },
    {
      label: "F",
      title: "Questions 23–26",
      kind: "FILL_BLANK",
      instructions: "Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
      questions: [
        {
          // Paragraph C: Sufi monks consumed coffee "to maintain
          // wakefulness and enhance their powers of concentration"
          number: 23,
          prompt:
            "In Yemen, Sufi monks were among the first to drink coffee regularly, using it to maintain ______ during night-time religious devotions.",
          options: null,
          answerRaw: "wakefulness",
          keyNote: "Paragraph C.",
          variants: [mkVariant("wakefulness")],
        },
        {
          // Paragraph E: coffeehouses provided "an environment conducive
          // to business discussion" as opposed to taverns' disorder.
          number: 24,
          prompt:
            "When coffeehouses spread through Europe, they were regarded as more respectable than taverns because they were sober institutions associated with ______ rather than with disorder.",
          options: null,
          answerRaw: "business discussion",
          keyNote: "Paragraph E.",
          variants: [mkVariant("business discussion")],
        },
        {
          // Paragraph F: "established the world's first colonial coffee
          // plantations in Java in 1696"
          number: 25,
          prompt: "The Dutch established the world's first colonial coffee plantations in ______ in 1696 after obtaining coffee seedlings from Yemen.",
          options: null,
          answerRaw: "Java",
          keyNote: "Paragraph F.",
          variants: [mkVariant("Java")],
        },
        {
          // Paragraph G: "the expansion of fungal diseases such as
          // coffee leaf rust"
          number: 26,
          prompt: "Environmental threats to coffee production include rising temperatures and the spread of fungal diseases such as coffee ______ .",
          options: null,
          answerRaw: "leaf rust",
          keyNote: "Paragraph G.",
          variants: [mkVariant("leaf rust")],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const readingMdRaw = stripFrontmatter(fs.readFileSync(path.join(TEST01_DIR, "reading.md"), "utf8"));
  const writingMdRaw = stripFrontmatter(fs.readFileSync(path.join(TEST01_DIR, "writing.md"), "utf8"));
  const answerKeyMdRaw = stripFrontmatter(fs.readFileSync(path.join(TEST01_DIR, "answer_key.md"), "utf8"));

  const readingMd = extractReadingMd(readingMdRaw);
  const writingPromptMd = extractWritingPromptMd(writingMdRaw);
  const bandTable = extractBandTable(answerKeyMdRaw);
  const sections = buildReadingSections();
  const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);

  // Re-resolve the placement listening set's id BY SLUG on every run — do
  // NOT hardcode or cache it. `seedListeningSets` (Task 12,
  // `scripts/seed/ingest.ts`) deletes and recreates the `ListeningSet` row
  // on every seed run, so its `id` is fresh each time. Caching a stale id
  // here would silently orphan `PlacementTest.listeningSetId` (a bare
  // `String?` with no Prisma `@relation`, so nothing would ever complain)
  // the next time listening sets are reseeded.
  const listeningSet = await db.listeningSet.findUnique({ where: { slug: LISTENING_SLUG } });
  if (!listeningSet) {
    console.warn(
      `[seed-placement] WARN: no ListeningSet with slug "${LISTENING_SLUG}" found — run 'npm run seed' first (seeds listening sets) so listeningSetId isn't null.`,
    );
  }

  // Delete + recreate on every run (same pre-launch policy as Exercise/
  // ListeningSet elsewhere in the seed pipeline — cascades wipe any prior
  // PlacementAttempt rows for the `default` test, acceptable since there
  // are no real learner attempts against this test yet).
  await db.placementTest.deleteMany({ where: { slug: PLACEMENT_SLUG } });
  const created = await db.placementTest.create({
    data: {
      slug: PLACEMENT_SLUG,
      readingMd,
      writingPromptMd,
      listeningSetId: listeningSet?.id ?? null,
      bandTable: bandTable as unknown as object,
      sections: {
        create: sections.map((section, sectionIndex) => ({
          label: section.label,
          title: section.title,
          kind: section.kind,
          instructions: section.instructions,
          orderIndex: sectionIndex,
          questions: {
            create: section.questions.map((q) => ({
              number: q.number,
              prompt: q.prompt,
              options: q.options ?? undefined,
              answerRaw: q.answerRaw,
              keyNote: q.keyNote,
              isOpenEnded: false,
              variants: { create: q.variants },
            })),
          },
        })),
      },
    },
  });

  console.log(
    `[seed-placement] upserted PlacementTest "${created.slug}" (id=${created.id}): ` +
      `${sections.length} sections, ${totalQuestions} reading questions, ` +
      `bandTable has ${bandTable.length} rows, listeningSetId=${listeningSet?.id ?? "null"}`,
  );

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
