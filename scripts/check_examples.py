#!/usr/bin/env python3
"""Structural quality gate for the interactive ```example blocks in lecture.md.

Usage:
  python3 scripts/check_examples.py                  # every drillable lecture
  python3 scripts/check_examples.py --phase 1        # one phase
  python3 scripts/check_examples.py path/to/lecture.md

Exits 1 if any lecture has an error. The web parser
(web/src/lib/lecture-examples.ts) drops a malformed block SILENTLY, so a
single typo would just make an example vanish from the page — this script
is what makes that loud. It also enforces the editorial rules: every
content section carries at least MIN_PER_SECTION examples, and no example
recycles a sentence the lecture already used as an illustration.

Stdlib only; the core checks are importable so tests call them directly.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from curriculum_lib import LESSON_DIR_RE, PHASE_DIR_RE

# Mirrors EXAMPLE_FENCE_RE / parseFenceBody in web/src/lib/lecture-examples.ts.
EXAMPLE_FENCE_RE = re.compile(
    r"^```example[ \t]*\n(.*?)^```[ \t]*$", re.MULTILINE | re.DOTALL
)
FIELD_RE = re.compile(r"^(id|prompt|hint|answer):\s*(.+)$")
REQUIRED_KEYS = ("id", "prompt", "hint", "answer")
BLANK_RE = re.compile(r"_{3,}")

H2_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
# Framing sections carry no teaching content of their own, so no examples.
SKIP_H2_RE = re.compile(
    r"GIỚI THIỆU|MỤC TIÊU BÀI HỌC|TÓM TẮT|LIÊN KẾT BÀI HỌC|BÀI TẬP", re.IGNORECASE
)

# Essay/speaking lectures: a gap-fill answer key cannot grade them objectively.
SKIP_LESSONS = {"phase_4_advanced/lesson_09_academic_essay_writing"}
SKIP_PHASES = {5}

MIN_PER_SECTION = 2


def parse_examples(text: str) -> tuple[list[dict], list[str]]:
    """Every ```example block, plus the errors that would make the web parser
    silently drop one."""
    examples: list[dict] = []
    errors: list[str] = []
    seen: set[str] = set()
    for match in EXAMPLE_FENCE_RE.finditer(text):
        body = match.group(1)
        line_no = text[: match.start()].count("\n") + 1
        fields: dict[str, str] = {}
        bad = False
        for raw in body.split("\n"):
            line = raw.strip()
            if not line:
                continue
            m = FIELD_RE.match(line)
            if not m:
                key = line.split(":", 1)[0]
                errors.append(f"line {line_no}: unknown/malformed key '{key}'")
                bad = True
                continue
            fields[m.group(1)] = m.group(2).strip()
        for key in REQUIRED_KEYS:
            if not fields.get(key):
                errors.append(f"line {line_no}: missing required key '{key}'")
                bad = True
        if bad:
            continue
        if not BLANK_RE.search(fields["prompt"]):
            errors.append(f"line {line_no}: prompt has no ___ blank")
            continue
        if fields["id"] in seen:
            errors.append(f"line {line_no}: duplicate id '{fields['id']}'")
            continue
        seen.add(fields["id"])
        fields["line"] = line_no
        fields["start"] = match.start()
        examples.append(fields)
    return examples, errors


def _sentences(text: str) -> set[str]:
    """Normalized English sentences the prose already uses as illustrations, so a
    recycled example can be caught."""
    prose = EXAMPLE_FENCE_RE.sub("", text)
    out = set()
    for line in prose.split("\n"):
        clean = re.sub(r"\([^)]*\)", " ", line)  # drop Vietnamese glosses
        clean = re.sub(r"[*_`|#-]", " ", clean)
        for part in re.split(r"[.!?]", clean):
            words = re.findall(r"[A-Za-z']+", part)
            if len(words) >= 4:
                out.add(" ".join(w.lower() for w in words))
    return out


def _example_sentence(prompt: str, answer: str) -> str:
    filled = BLANK_RE.sub(answer.split("/")[0].strip(), prompt)
    filled = re.sub(r"\([^)]*\)", " ", filled)
    return " ".join(w.lower() for w in re.findall(r"[A-Za-z']+", filled))


def check_lecture(text: str, min_per_section: int = MIN_PER_SECTION) -> list[str]:
    """Errors for one lecture: malformed blocks, thin sections, recycled sentences."""
    examples, errors = parse_examples(text)

    prose = _sentences(text)
    for ex in examples:
        if _example_sentence(ex["prompt"], ex["answer"]) in prose:
            errors.append(
                f"line {ex['line']}: ví dụ '{ex['id']}' trùng câu đã có trong bài giảng"
            )

    headings = [(m.start(), m.group(1)) for m in H2_RE.finditer(text)]
    for i, (start, title) in enumerate(headings):
        if SKIP_H2_RE.search(title):
            continue
        end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
        count = sum(1 for ex in examples if start < ex["start"] < end)
        if count < min_per_section:
            errors.append(f"section '{title}': {count} ví dụ (cần ≥ {min_per_section})")
    return errors


def lecture_paths(root: Path, phase: int | None = None) -> list[Path]:
    paths = []
    for phase_dir in sorted(root.glob("phase_*")):
        pm = PHASE_DIR_RE.match(phase_dir.name)
        if not pm or int(pm.group(1)) in SKIP_PHASES:
            continue
        if phase is not None and int(pm.group(1)) != phase:
            continue
        for lesson_dir in sorted(phase_dir.glob("lesson_*")):
            if not LESSON_DIR_RE.match(lesson_dir.name):
                continue
            if f"{phase_dir.name}/{lesson_dir.name}" in SKIP_LESSONS:
                continue
            lecture = lesson_dir / "lecture.md"
            if lecture.is_file():
                paths.append(lecture)
    return paths


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="*", type=Path)
    parser.add_argument("--phase", type=int)
    parser.add_argument("--min", type=int, default=MIN_PER_SECTION)
    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    paths = args.paths or lecture_paths(root, args.phase)

    total_errors = 0
    total_examples = 0
    for path in paths:
        text = path.read_text(encoding="utf-8")
        examples, _ = parse_examples(text)
        total_examples += len(examples)
        errors = check_lecture(text, args.min)
        rel = path.relative_to(root) if path.is_absolute() else path
        if errors:
            total_errors += len(errors)
            print(f"\n{rel}")
            for err in errors:
                print(f"  ERROR: {err}")
    print(f"\n{len(paths)} lecture(s), {total_examples} example(s), {total_errors} error(s)")
    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
