import fs from "fs";
import path from "path";
import { listLessons } from "./parse-lesson";
import { parseExercise } from "./parse-exercise";
import { loadOverrides, scopedOverrides } from "./overrides-loader";

function parseArgs(argv: string[]) {
  return { strict: argv.includes("--strict") };
}

function main() {
  const { strict } = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(process.cwd(), "..");
  const overrides = loadOverrides();
  const lessons = listLessons(repoRoot);

  let dirty = false;
  let totalSections = 0;
  let totalQuestions = 0;
  let totalWithVariants = 0;
  let totalUnmatched = 0;
  let cleanLessons = 0;

  console.log(`[validate] repoRoot=${repoRoot} lessons=${lessons.length}`);
  console.log("-".repeat(100));

  for (const lesson of lessons) {
    const exercisePath = path.join(lesson.dir, "exercise.md");
    if (!fs.existsSync(exercisePath)) {
      console.log(
        `${lesson.phaseSlug}/${lesson.lessonSlug}: NO exercise.md`
      );
      continue;
    }

    const md = fs.readFileSync(exercisePath, "utf8");
    let parsed: ReturnType<typeof parseExercise>;
    try {
      parsed = parseExercise(md, scopedOverrides(overrides, lesson.lessonSlug));
    } catch (err) {
      console.log(
        `${lesson.phaseSlug}/${lesson.lessonSlug}: PARSE ERROR — ${(err as Error).message}`
      );
      dirty = true;
      continue;
    }

    const sections = parsed.sections;
    const questions = sections.flatMap((s) => s.questions);
    const withVariants = questions.filter(
      (q) => q.isOpenEnded || q.variants.length > 0
    );
    const zeroQuestionSections = sections.filter((s) => s.questions.length === 0);
    const unmatched = parsed.diagnostics.unmatchedAnswers;
    const missingVariants = questions.filter(
      (q) => !q.isOpenEnded && q.variants.length === 0
    );

    totalSections += sections.length;
    totalQuestions += questions.length;
    totalWithVariants += withVariants.length;
    totalUnmatched += unmatched.length;

    const problems: string[] = [];
    if (zeroQuestionSections.length > 0) {
      problems.push(
        `${zeroQuestionSections.length} zero-question section(s) [${zeroQuestionSections.map((s) => s.label).join(",")}]`
      );
    }
    if (unmatched.length > 0) {
      problems.push(`${unmatched.length} unmatched key answer(s) [${unmatched.join(",")}]`);
    }
    if (missingVariants.length > 0) {
      problems.push(
        `${missingVariants.length} non-open question(s) with 0 variants [${missingVariants.map((q) => q.number).join(",")}]`
      );
    }
    if (!parsed.diagnostics.keyFound) {
      problems.push("no answer key found (treated as fully open-ended)");
    }

    const isClean = zeroQuestionSections.length === 0 && unmatched.length === 0 && missingVariants.length === 0;
    if (isClean) cleanLessons++;
    else dirty = true;

    const status = isClean ? "OK  " : "WARN";
    console.log(
      `${status} ${lesson.phaseSlug}/${lesson.lessonSlug}: sections=${sections.length} questions=${questions.length} withVariants=${withVariants.length}${problems.length ? " | " + problems.join("; ") : ""}`
    );
  }

  console.log("-".repeat(100));
  console.log(
    `[validate] done. lessons=${lessons.length} cleanLessons=${cleanLessons} totalSections=${totalSections} totalQuestions=${totalQuestions} totalWithVariants=${totalWithVariants} totalUnmatchedAnswers=${totalUnmatched}`
  );

  if (strict && dirty) {
    console.error("[validate] --strict: FAILED (see WARN lines above)");
    process.exit(1);
  }
}

main();
