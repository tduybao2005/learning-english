#!/usr/bin/env python3
"""Structural quality gate for TOEIC practice tests.

Usage:
  python3 scripts/check_toeic.py                # check every toeic_practice_tests/test_*
  python3 scripts/check_toeic.py test_01 test_02 # check specific tests only

Exits 1 if any test has a structural error. Warnings (e.g. duplicate
verbatim passages across tests) are printed but do not affect the exit
code. Stdlib only; core checks are importable so tests can call them
directly without subprocess.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

READING_Q_RE = re.compile(r"^\*\*(\d{3})\.\*\*", re.MULTILINE)
ANSWER_Q_RE = re.compile(r"^(\d{3})\.\s*([A-Za-z])", re.MULTILINE)
SPEAKING_Q_RE = re.compile(r"^#{1,4}\s*Q(\d{1,2})\b", re.MULTILINE)
WRITING_Q_RE = re.compile(r"^#{1,4}\s*Q(\d{1,2})\b", re.MULTILINE)
GOI_Y_RE = re.compile(r"Gợi ý")

VALID_LETTERS = {"A", "B", "C", "D"}


def check_reading(text: str) -> list[str]:
    errors = []
    all_numbers = [int(m.group(1)) for m in READING_Q_RE.finditer(text)]
    seen = set()
    dupes = set()
    for n in all_numbers:
        if n in seen:
            dupes.add(n)
        seen.add(n)
    if dupes:
        errors.append(f"reading.md: duplicate question number(s) {sorted(dupes)}")
    missing = [n for n in range(101, 201) if n not in seen]
    if missing:
        errors.append(f"reading.md: missing question(s) {missing}")
    for label in ("PART 5", "PART 6", "PART 7"):
        if label not in text:
            errors.append(f"reading.md: missing heading '{label}'")
    return errors


def check_answer_key(text: str) -> list[str]:
    errors = []
    numbers_letters: dict[int, list[str]] = {}
    for m in ANSWER_Q_RE.finditer(text):
        n = int(m.group(1))
        if 101 <= n <= 200:
            numbers_letters.setdefault(n, []).append(m.group(2).upper())
    missing = [n for n in range(101, 201) if n not in numbers_letters]
    if missing:
        errors.append(f"answer_key.md: missing answer(s) for {missing}")
    for n, letters in numbers_letters.items():
        for letter in letters:
            if letter not in VALID_LETTERS:
                errors.append(f"answer_key.md: invalid answer letter '{letter}' for question {n}")
    if "BẢNG QUY ĐỔI" not in text:
        errors.append("answer_key.md: missing heading 'BẢNG QUY ĐỔI'")
    raw_values = set()
    for m in re.finditer(r"\|\s*(\d{1,3})\s*\|", text):
        v = int(m.group(1))
        if 0 <= v <= 100:
            raw_values.add(v)
    if not ({0, 100} <= raw_values or (raw_values and max(raw_values) >= 95 and min(raw_values) <= 5)):
        errors.append("answer_key.md: conversion table does not cover raw range 0-100")
    return errors


def _check_questions_with_goi_y(text: str, q_re: re.Pattern, lo: int, hi: int,
                                 fname: str) -> list[str]:
    errors = []
    matches = list(q_re.finditer(text))
    numbers = {int(m.group(1)) for m in matches}
    missing = [n for n in range(lo, hi + 1) if n not in numbers]
    if missing:
        errors.append(f"{fname}: missing question(s) Q{missing}")
    positions = sorted((int(m.group(1)), m.start()) for m in matches)
    for i, (n, start) in enumerate(positions):
        end = positions[i + 1][1] if i + 1 < len(positions) else len(text)
        block = text[start:end]
        if not GOI_Y_RE.search(block):
            errors.append(f"{fname}: question Q{n} missing 'Gợi ý' block")
    return errors


def check_speaking(text: str) -> list[str]:
    return _check_questions_with_goi_y(text, SPEAKING_Q_RE, 1, 11, "speaking.md")


def check_writing(text: str) -> list[str]:
    return _check_questions_with_goi_y(text, WRITING_Q_RE, 1, 8, "writing.md")


def check_listening(text: str) -> list[str]:
    errors = []
    for label in ("PART 1", "PART 2", "PART 3", "PART 4"):
        if label not in text:
            errors.append(f"listening.md: missing heading '{label}'")
    return errors


def check_test(test_dir: Path) -> list[str]:
    """Return a list of structural error strings for one test_NN directory."""
    errors = []
    checks = (
        ("reading.md", check_reading),
        ("answer_key.md", check_answer_key),
        ("speaking.md", check_speaking),
        ("writing.md", check_writing),
        ("listening.md", check_listening),
    )
    for fname, fn in checks:
        path = test_dir / fname
        if not path.is_file():
            errors.append(f"{test_dir.name}: missing file {fname}")
            continue
        text = path.read_text(encoding="utf-8")
        errors.extend(f"{test_dir.name}/{e}" for e in fn(text))
    return errors


def find_duplicate_passages(test_dirs: list[Path]) -> list[str]:
    """Return warning strings for verbatim lines >80 chars shared across tests."""
    warnings = []
    line_owner: dict[str, str] = {}
    for d in test_dirs:
        reading = d / "reading.md"
        if not reading.is_file():
            continue
        for line in reading.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if len(stripped) <= 80:
                continue
            owner = line_owner.get(stripped)
            if owner and owner != d.name:
                warnings.append(
                    f"duplicate passage line >80 chars shared between {owner} and {d.name}: "
                    f"{stripped[:80]}...")
            else:
                line_owner[stripped] = d.name
    return warnings


def main(argv: list[str]) -> int:
    root = Path(".").resolve()
    tests_root = root / "toeic_practice_tests"
    if argv:
        test_dirs = [tests_root / name for name in argv]
    else:
        test_dirs = sorted(tests_root.glob("test_*")) if tests_root.is_dir() else []

    all_errors = []
    for d in test_dirs:
        if not d.is_dir():
            all_errors.append(f"{d.name}: directory not found")
            continue
        all_errors.extend(check_test(d))

    warnings = find_duplicate_passages([d for d in test_dirs if d.is_dir()])

    for w in warnings:
        print(f"WARN: {w}")
    for e in all_errors:
        print(f"ERROR: {e}", file=sys.stderr)
    print(f"{len(test_dirs)} test(s) checked, {len(all_errors)} errors, {len(warnings)} warnings")
    return 1 if all_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
