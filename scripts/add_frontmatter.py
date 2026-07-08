#!/usr/bin/env python3
"""Prepend YAML frontmatter to curriculum content files. Idempotent:
files already starting with '---' are skipped. Stdlib only.

Usage: python3 scripts/add_frontmatter.py [--root DIR] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from curriculum_lib import classify, has_frontmatter, read_title  # noqa: E402

CONTENT_GLOBS = ("phase_*/*/*.md", "ielts_practice_tests/test_*/*.md",
                  "toeic_practice_tests/test_*/*.md")


def frontmatter_for(root: Path, rel: Path) -> str | None:
    meta = classify(rel)
    if meta is None:
        return None
    title = read_title(root / rel)
    lines = ["---",
             f"id: {json.dumps(meta['id'])}",
             f"type: {meta['type']}"]
    if "phase" in meta:
        lines.append(f"phase: {meta['phase']}")
    if "test" in meta:
        lines.append(f"test: {meta['test']}")
    if "lesson" in meta:
        lines.append(f"lesson: {meta['lesson']}")
    if "topic" in meta:
        lines.append(f"topic: {json.dumps(meta['topic'])}")
    lines += [f"cefr: {meta['cefr']}",
              f"title: {json.dumps(title, ensure_ascii=False)}",
              "lang: vi-en",
              "---"]
    return "\n".join(lines) + "\n\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    changed = skipped = 0
    for pattern in CONTENT_GLOBS:
        for path in sorted(root.glob(pattern)):
            rel = path.relative_to(root)
            text = path.read_text(encoding="utf-8")
            if has_frontmatter(text):
                skipped += 1
                continue
            block = frontmatter_for(root, rel)
            if block is None:
                continue
            if not args.dry_run:
                path.write_text(block + text, encoding="utf-8")
            changed += 1
            print(f"add: {rel}")
    mode = "would update" if args.dry_run else "updated"
    print(f"{mode} {changed} files, {skipped} already had frontmatter")
    return 0


if __name__ == "__main__":
    sys.exit(main())
