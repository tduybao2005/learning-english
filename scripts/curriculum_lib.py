"""Shared helpers for curriculum tooling. Python stdlib only.

Understands the repo layout:
  phase_<N>_<name>/lesson_<NN>_<slug>/{lecture,vocabulary,exercise}.md
  phase_<N>_<name>/exam/phase<N>_{exam,answer_key}.md
  ielts_practice_tests/test_<NN>/{reading,writing,speaking,answer_key}.md
plus score_report_*.md and feedback.md files that may sit in any of those dirs.
"""
from __future__ import annotations

import re
from pathlib import Path

PHASE_CEFR = {1: "A1-A2", 2: "A2-B1", 3: "B1-B2", 4: "B2-C1", 5: "C1"}

PHASE_DIR_RE = re.compile(r"^phase_(\d)_([a-z_]+)$")
LESSON_DIR_RE = re.compile(r"^lesson_(\d{2})_([a-z0-9_]+)$")
TEST_DIR_RE = re.compile(r"^test_(\d{2})$")

LESSON_FILES = ("lecture.md", "vocabulary.md", "exercise.md")
IELTS_FILES = ("reading.md", "writing.md", "speaking.md", "answer_key.md")


def read_title(path: Path) -> str:
    """First '# ' heading in the file, else the file stem."""
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    except FileNotFoundError:
        pass
    return path.stem


def has_frontmatter(text: str) -> bool:
    return text.startswith("---\n") or text.startswith("---\r\n")


def classify(rel_path: Path) -> dict | None:
    """Metadata for one content file (repo-relative path), or None."""
    parts = rel_path.parts
    if len(parts) != 3 or not parts[2].endswith(".md"):
        return None
    top, sub, name = parts
    meta = {"id": str(rel_path)[: -len(".md")]}

    pm = PHASE_DIR_RE.match(top)
    if pm:
        phase = int(pm.group(1))
        meta["phase"] = phase
        meta["cefr"] = PHASE_CEFR.get(phase, "")
        lm = LESSON_DIR_RE.match(sub)
        if lm:
            meta["lesson"] = sub
            meta["topic"] = lm.group(2).replace("_", " ")
            if name in LESSON_FILES:
                meta["type"] = name[: -len(".md")]
            elif name.startswith("score_report"):
                meta["type"] = "score_report"
            elif name == "feedback.md":
                meta["type"] = "feedback"
            else:
                meta["type"] = "lesson_extra"
            return meta
        if sub == "exam":
            if name.endswith("_answer_key.md"):
                meta["type"] = "phase_exam_answer_key"
            elif name.endswith("_exam.md"):
                meta["type"] = "phase_exam"
            elif name.startswith("score_report"):
                meta["type"] = "score_report"
            else:
                meta["type"] = "exam_extra"
            return meta
        return None

    if top == "ielts_practice_tests":
        tm = TEST_DIR_RE.match(sub)
        if not tm:
            return None
        meta["test"] = int(tm.group(1))
        meta["cefr"] = "C1"
        if name in IELTS_FILES:
            meta["type"] = "ielts_" + name[: -len(".md")]
        elif name.startswith("score_report"):
            meta["type"] = "score_report"
        else:
            meta["type"] = "ielts_extra"
        return meta

    return None


def scan_repo(root: Path) -> dict:
    """Inventory of phases/lessons/exams and IELTS tests with completeness flags."""
    phases = []
    for pdir in sorted(root.glob("phase_*")):
        pm = PHASE_DIR_RE.match(pdir.name)
        if not (pdir.is_dir() and pm):
            continue
        num = int(pm.group(1))
        lessons = []
        for ldir in sorted(pdir.glob("lesson_*")):
            lm = LESSON_DIR_RE.match(ldir.name)
            if not (ldir.is_dir() and lm):
                continue
            present = {f: (ldir / f).is_file() for f in LESSON_FILES}
            lecture = ldir / "lecture.md"
            lessons.append({
                "dir": f"{pdir.name}/{ldir.name}",
                "number": int(lm.group(1)),
                "topic": lm.group(2).replace("_", " "),
                "title": read_title(lecture) if lecture.is_file() else ldir.name,
                "files": present,
                "complete": all(present.values()),
                "score_reports": sorted(p.name for p in ldir.glob("score_report_*.md")),
            })
        exam = None
        exam_dir = pdir / "exam"
        if exam_dir.is_dir():
            exam = {
                "dir": f"{pdir.name}/exam",
                "exam": (exam_dir / f"phase{num}_exam.md").is_file(),
                "answer_key": (exam_dir / f"phase{num}_answer_key.md").is_file(),
            }
        phases.append({
            "dir": pdir.name,
            "number": num,
            "name": pm.group(2),
            "cefr": PHASE_CEFR.get(num, ""),
            "lessons": lessons,
            "exam": exam,
        })

    tests = []
    tests_root = root / "ielts_practice_tests"
    if tests_root.is_dir():
        for tdir in sorted(tests_root.glob("test_*")):
            tm = TEST_DIR_RE.match(tdir.name)
            if not (tdir.is_dir() and tm):
                continue
            present = {f: (tdir / f).is_file() for f in IELTS_FILES}
            tests.append({
                "dir": f"ielts_practice_tests/{tdir.name}",
                "number": int(tm.group(1)),
                "files": present,
                "complete": all(present.values()),
                "score_reports": sorted(p.name for p in tdir.glob("score_report_*.md")),
            })

    return {"phases": phases, "ielts_tests": tests}
