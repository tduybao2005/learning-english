import fs from "fs";
import path from "path";

export interface LessonRef {
  phaseSlug: string;
  phaseOrder: number;
  lessonSlug: string;
  lessonOrder: number;
  title: string;
  dir: string;
}

export const PHASE_META: Record<string, { title: string; cefrLabel: string }> = {
  phase_1_foundation: { title: "Giai đoạn 1: Nền tảng", cefrLabel: "A1→A2" },
  phase_2_elementary: { title: "Giai đoạn 2: Sơ cấp", cefrLabel: "A2→B1" },
  phase_3_intermediate: { title: "Giai đoạn 3: Trung cấp", cefrLabel: "B1→B2" },
  phase_4_advanced: { title: "Giai đoạn 4: Nâng cao", cefrLabel: "B2→C1" },
  phase_5_ielts_prep: { title: "Giai đoạn 5: Luyện IELTS", cefrLabel: "C1" },
};

const PHASE_DIR_RE = /^phase_(\d+)_/;
const LESSON_DIR_RE = /^lesson_(\d+)_/;

function isDir(p: string): boolean {
  return fs.statSync(p).isDirectory();
}

function readTitle(lectureMdPath: string): string {
  const content = fs.readFileSync(lectureMdPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return "";
}

export function listLessons(repoRoot: string): LessonRef[] {
  const lessons: LessonRef[] = [];

  const phaseDirs = fs
    .readdirSync(repoRoot)
    .filter((d) => PHASE_DIR_RE.test(d) && isDir(path.join(repoRoot, d)))
    .sort();

  for (const phaseSlug of phaseDirs) {
    const phaseMatch = phaseSlug.match(PHASE_DIR_RE)!;
    const phaseOrder = parseInt(phaseMatch[1], 10);
    const phaseDir = path.join(repoRoot, phaseSlug);

    const lessonDirs = fs
      .readdirSync(phaseDir)
      .filter((d) => LESSON_DIR_RE.test(d) && isDir(path.join(phaseDir, d)))
      .sort();

    for (const lessonSlug of lessonDirs) {
      const lessonMatch = lessonSlug.match(LESSON_DIR_RE)!;
      const lessonOrder = parseInt(lessonMatch[1], 10);
      const dir = path.join(phaseDir, lessonSlug);
      const lectureMdPath = path.join(dir, "lecture.md");
      const title = fs.existsSync(lectureMdPath) ? readTitle(lectureMdPath) : "";

      lessons.push({ phaseSlug, phaseOrder, lessonSlug, lessonOrder, title, dir });
    }
  }

  return lessons;
}
