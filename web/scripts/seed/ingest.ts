import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { db } from "../../src/lib/db";
import { listLessons, PHASE_META } from "./parse-lesson";
import { parseVocab } from "./parse-vocab";
import { parseExercise } from "./parse-exercise";
import { parseListening } from "./parse-listening";
import { loadOverrides, scopedOverrides } from "./overrides-loader";
import { stripFrontmatter } from "./strip-frontmatter";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let force = false;
  let phase: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--force") force = true;
    else if (a === "--phase") phase = parseInt(argv[++i], 10);
    else if (a.startsWith("--phase=")) phase = parseInt(a.slice("--phase=".length), 10);
  }
  return { dryRun, force, phase };
}

function readOptional(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function contentHashOf(lectureMd: string, vocabMd: string, exerciseMd: string): string {
  return crypto
    .createHash("sha256")
    .update(lectureMd)
    .update("\0")
    .update(vocabMd)
    .update("\0")
    .update(exerciseMd)
    .digest("hex");
}

/** Reads an mp3's duration via `ffprobe` (assumed present locally — same
 * environment that runs `generate_audio.py`). Returns null (not an error)
 * if the file or the `ffprobe` binary is missing, so seeding never hard-fails
 * just because audio hasn't been generated yet for a given listening set. */
function probeDurationSec(mp3Path: string): number | null {
  if (!fs.existsSync(mp3Path)) return null;
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      mp3Path,
    ]).toString().trim();
    const sec = parseFloat(out);
    return Number.isFinite(sec) ? Math.round(sec) : null;
  } catch (err) {
    console.warn(`[seed] WARN: ffprobe failed for ${mp3Path}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Seeds `content/listening/*.md` into `ListeningSet` (+ Section/Question/
 * AnswerVariant via `listeningSetId`, mirroring the Exercise subtree shape).
 * Delete + recreate on every run (like the Exercise subtree above) — listening
 * sets are few and hand-authored, so a content-hash skip isn't worth the
 * complexity yet.
 */
async function seedListeningSets(repoRoot: string, dryRun: boolean) {
  const contentDir = path.join(repoRoot, "web", "content", "listening");
  if (!fs.existsSync(contentDir)) {
    console.log("[seed] no web/content/listening directory — skipping listening sets");
    return { count: 0, questions: 0 };
  }

  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md")).sort();
  let count = 0;
  let totalQuestions = 0;
  const seenSlugs: string[] = [];

  for (const file of files) {
    const md = fs.readFileSync(path.join(contentDir, file), "utf8");
    const parsed = parseListening(md);
    const { slug, title, kind, level } = parsed.frontMatter;
    seenSlugs.push(slug);
    if (kind === "PRACTICE" && !level) {
      console.warn(
        `[seed] WARN: ${slug} is PRACTICE but has no front-matter 'level' — hub will group it under "Khác"`,
      );
    }
    const audioUrl = `/audio/listening/${slug}.mp3`;
    const mp3Path = path.join(repoRoot, "web", "public", "audio", "listening", `${slug}.mp3`);
    const durationSec = probeDurationSec(mp3Path);
    const questionCount = parsed.questions.sections.reduce((n, s) => n + s.questions.length, 0);

    if (!fs.existsSync(mp3Path)) {
      console.warn(`[seed] WARN: ${slug} has no generated mp3 at ${mp3Path} — run scripts/tts/generate_audio.py first`);
    }

    if (dryRun) {
      console.log(
        `[seed] would upsert listening set: ${slug} "${title}" (${questionCount} questions, duration=${durationSec ?? "?"}s)`
      );
      count++;
      totalQuestions += questionCount;
      continue;
    }

    // Cascades (ListeningSet -> Section -> Question -> AnswerVariant) wipe
    // any prior rows for this slug — acceptable pre-launch, same reasoning
    // as the Exercise subtree above.
    await db.listeningSet.deleteMany({ where: { slug } });
    await db.listeningSet.create({
      data: {
        slug,
        title,
        kind,
        level: level ?? undefined,
        audioUrl,
        transcriptMd: parsed.transcriptMd,
        durationSec: durationSec ?? undefined,
        sections: {
          create: parsed.questions.sections.map((section, sectionIndex) => ({
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
                imageUrl: q.imageUrl,
                answerRaw: q.answerRaw,
                keyNote: q.keyNote,
                isOpenEnded: q.isOpenEnded,
                variants: {
                  create: q.variants.map((v) => ({ text: v.text, normalized: v.normalized })),
                },
              })),
            },
          })),
        },
      },
    });

    console.log(
      `[seed] listening set upserted: ${slug} "${title}" (${questionCount} questions, duration=${durationSec ?? "?"}s)`
    );
    count++;
    totalQuestions += questionCount;
  }

  // Prune sets whose .md no longer exists (e.g. renamed slugs). Guarded on
  // files.length so an empty/missing content dir can never mass-delete.
  if (files.length > 0) {
    if (dryRun) {
      const orphans = await db.listeningSet.findMany({
        where: { slug: { notIn: seenSlugs } },
        select: { slug: true },
      });
      if (orphans.length > 0) {
        console.log(`[seed] would prune listening set(s): ${orphans.map((o) => o.slug).join(", ")}`);
      }
    } else {
      const pruned = await db.listeningSet.deleteMany({ where: { slug: { notIn: seenSlugs } } });
      if (pruned.count > 0) {
        console.log(`[seed] pruned ${pruned.count} listening set(s) no longer in content/listening`);
      }
    }
  }

  return { count, questions: totalQuestions };
}

async function main() {
  const { dryRun, force, phase } = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(process.cwd(), "..");

  let lessons = listLessons(repoRoot);
  if (phase !== undefined) {
    lessons = lessons.filter((l) => l.phaseOrder === phase);
  }

  console.log(
    `[seed] repoRoot=${repoRoot} lessons=${lessons.length}${phase !== undefined ? ` (filtered to phase ${phase})` : ""}${dryRun ? " [dry-run]" : ""}${force ? " [force]" : ""}`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let totalWords = 0;
  let totalQuestions = 0;
  const overridesAll = loadOverrides();

  for (const lesson of lessons) {
    const meta = PHASE_META[lesson.phaseSlug];
    if (!meta) {
      console.warn(`[seed] WARN: no PHASE_META entry for "${lesson.phaseSlug}", skipping lesson ${lesson.lessonSlug}`);
      continue;
    }

    const lectureMdPath = path.join(lesson.dir, "lecture.md");
    const vocabMdPath = path.join(lesson.dir, "vocabulary.md");
    const exerciseMdPath = path.join(lesson.dir, "exercise.md");

    const lectureMd = stripFrontmatter(readOptional(lectureMdPath));
    const vocabMd = stripFrontmatter(readOptional(vocabMdPath));
    const exerciseMd = stripFrontmatter(readOptional(exerciseMdPath));

    if (!fs.existsSync(vocabMdPath)) {
      console.warn(`[seed] WARN: ${lesson.phaseSlug}/${lesson.lessonSlug} has no vocabulary.md — 0 vocab words will be stored`);
    }

    const contentHash = contentHashOf(lectureMd, vocabMd, exerciseMd);
    const words = parseVocab(vocabMd);

    const existingPhase = await db.phase.findUnique({ where: { slug: lesson.phaseSlug } });
    const existingLesson = existingPhase
      ? await db.lesson.findUnique({
          where: { phaseId_slug: { phaseId: existingPhase.id, slug: lesson.lessonSlug } },
        })
      : null;

    if (existingLesson && existingLesson.contentHash === contentHash && !force) {
      console.log(`[seed] skipped (unchanged): ${lesson.phaseSlug}/${lesson.lessonSlug}`);
      skipped++;
      continue;
    }

    const action = existingLesson ? "update" : "create";
    if (dryRun) {
      const previewQuestionCount = exerciseMd.trim()
        ? parseExercise(exerciseMd, scopedOverrides(overridesAll, lesson.lessonSlug)).sections.reduce(
            (n, s) => n + s.questions.length,
            0
          )
        : 0;
      console.log(
        `[seed] would ${action}: ${lesson.phaseSlug}/${lesson.lessonSlug} "${lesson.title}" (${words.length} vocab words, ${previewQuestionCount} exercise questions)`
      );
      if (action === "update") updated++;
      else created++;
      totalWords += words.length;
      totalQuestions += previewQuestionCount;
      continue;
    }

    const phaseRow = await db.phase.upsert({
      where: { slug: lesson.phaseSlug },
      update: { orderIndex: lesson.phaseOrder, title: meta.title, cefrLabel: meta.cefrLabel },
      create: {
        slug: lesson.phaseSlug,
        orderIndex: lesson.phaseOrder,
        title: meta.title,
        cefrLabel: meta.cefrLabel,
      },
    });

    const lessonRow = await db.lesson.upsert({
      where: { phaseId_slug: { phaseId: phaseRow.id, slug: lesson.lessonSlug } },
      update: {
        orderIndex: lesson.lessonOrder,
        title: lesson.title,
        lectureMd,
        sourceDir: lesson.dir,
        contentHash,
      },
      create: {
        phaseId: phaseRow.id,
        slug: lesson.lessonSlug,
        orderIndex: lesson.lessonOrder,
        title: lesson.title,
        lectureMd,
        sourceDir: lesson.dir,
        contentHash,
      },
    });

    await db.vocabWord.deleteMany({ where: { lessonId: lessonRow.id } });
    if (words.length > 0) {
      await db.vocabWord.createMany({
        data: words.map((w, i) => ({
          lessonId: lessonRow.id,
          groupName: w.groupName,
          word: w.word,
          ipa: w.ipa,
          meaningVi: w.meaningVi,
          exampleEn: w.exampleEn,
          orderIndex: i,
        })),
      });
    }

    // Exercise subtree: delete + recreate on every hash-changed upsert.
    // `onDelete: Cascade` from Exercise -> Section -> Question -> AnswerVariant
    // (and Exercise -> ExerciseAttempt) means this also wipes any in-progress
    // attempts tied to the old Exercise row — acceptable pre-launch per the
    // plan, since there are no real learner attempts yet.
    await db.exercise.deleteMany({ where: { lessonId: lessonRow.id } });
    let questionCount = 0;
    if (exerciseMd.trim()) {
      const parsedExercise = parseExercise(
        exerciseMd,
        scopedOverrides(overridesAll, lesson.lessonSlug)
      );
      questionCount = parsedExercise.sections.reduce((n, s) => n + s.questions.length, 0);
      await db.exercise.create({
        data: {
          lessonId: lessonRow.id,
          title: parsedExercise.title || lesson.title,
          sections: {
            create: parsedExercise.sections.map((section, sectionIndex) => ({
              label: section.label,
              title: section.title,
              kind: section.kind,
              instructions: section.instructions,
              orderIndex: sectionIndex,
              questions: {
                create: section.questions.map((q) => ({
                  number: q.number,
                  prompt: q.prompt,
                  // Json? field: pass `undefined` (not `null`) for "no options"
                  // so Prisma leaves the column at its SQL NULL default rather
                  // than throwing ("use Prisma.DbNull instead of null").
                  options: q.options ?? undefined,
                  answerRaw: q.answerRaw,
                  keyNote: q.keyNote,
                  isOpenEnded: q.isOpenEnded,
                  variants: {
                    create: q.variants.map((v) => ({ text: v.text, normalized: v.normalized })),
                  },
                })),
              },
            })),
          },
        },
      });
    } else if (fs.existsSync(exerciseMdPath)) {
      console.warn(`[seed] WARN: ${lesson.phaseSlug}/${lesson.lessonSlug} has an empty exercise.md — 0 exercise questions stored`);
    }

    console.log(
      `[seed] ${action}d: ${lesson.phaseSlug}/${lesson.lessonSlug} "${lesson.title}" (${words.length} vocab words, ${questionCount} exercise questions)`
    );
    if (action === "update") updated++;
    else created++;
    totalWords += words.length;
    totalQuestions += questionCount;
  }

  console.log(
    `[seed] done. created=${created} updated=${updated} skipped=${skipped} totalVocabWordsWritten=${totalWords} totalExerciseQuestionsWritten=${totalQuestions}${dryRun ? " (dry-run, no writes)" : ""}`
  );

  // Listening sets are independent of the phase/lesson walk above (and of
  // `--phase` filtering) — always seed all of `content/listening/*.md`.
  const listeningResult = await seedListeningSets(repoRoot, dryRun);
  console.log(
    `[seed] listening sets: ${listeningResult.count} set(s), ${listeningResult.questions} question(s)${dryRun ? " (dry-run, no writes)" : ""}`
  );

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
