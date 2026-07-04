#!/usr/bin/env python3
"""Generate a listening-set mp3 from an authored `content/listening/*.md` file.

Usage:
    cd web
    python scripts/tts/generate_audio.py content/listening/practice_01.md

Setup (one-time, local — regeneration never runs on the deploy path per the
plan's "Listening audio" constraint):
    cd web/scripts/tts
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt

What it does:
  1. Parses the file's front matter `voices: { A: ..., B: ... }` mapping and
     the `## TRANSCRIPT` section's `SPEAKER: text` lines (same front-matter /
     transcript boundary convention as `scripts/seed/parse-listening.ts` —
     kept in sync by hand since one is TS and one is Python).
  2. Synthesizes each transcript line with edge-tts using that line's
     speaker's mapped voice.
  3. Concatenates all lines with pydub, inserting ~400ms of silence between
     turns.
  4. Exports a 48kbps mono mp3 to `web/public/audio/listening/{slug}.mp3`
     (path resolved relative to this script's location, not the caller's
     cwd, so it works whether invoked from `web/` or elsewhere).
  5. Prints the resulting duration and file size.
"""

import argparse
import asyncio
import re
import sys
import tempfile
from pathlib import Path

import edge_tts
from pydub import AudioSegment

FRONT_MATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)
TRANSCRIPT_HEAD_RE = re.compile(r"^##[ \t]+TRANSCRIPT[ \t]*$", re.MULTILINE)
QUESTIONS_HEAD_RE = re.compile(r"^##[ \t]+QUESTIONS\b.*$", re.MULTILINE)
LINE_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.+)$")
SILENCE_MS = 400


def parse_front_matter(block: str) -> dict:
    fm: dict = {"slug": None, "title": None, "kind": "PRACTICE", "voices": {}}
    for line in block.splitlines():
        m = re.match(r"^([A-Za-z_]+):[ \t]*(.*)$", line)
        if not m:
            continue
        key, raw = m.group(1), m.group(2).strip()
        if key == "slug":
            fm["slug"] = raw
        elif key == "title":
            fm["title"] = raw.strip('"')
        elif key == "kind":
            fm["kind"] = raw
        elif key == "voices":
            inner = raw.strip()
            if inner.startswith("{") and inner.endswith("}"):
                inner = inner[1:-1]
            for pair in inner.split(","):
                if ":" not in pair:
                    continue
                k, v = pair.split(":", 1)
                k, v = k.strip(), v.strip()
                if k and v:
                    fm["voices"][k] = v
    if not fm["slug"]:
        raise ValueError("front matter missing required 'slug'")
    return fm


def parse_transcript_lines(md: str) -> list[tuple[str, str]]:
    fm_m = FRONT_MATTER_RE.match(md)
    if not fm_m:
        raise ValueError("missing '---' front matter block")
    rest = md[fm_m.end():]

    t_m = TRANSCRIPT_HEAD_RE.search(rest)
    if not t_m:
        raise ValueError("missing '## TRANSCRIPT' section")
    q_m = QUESTIONS_HEAD_RE.search(rest)
    end = q_m.start() if q_m else len(rest)
    transcript_block = rest[t_m.end():end]

    lines: list[tuple[str, str]] = []
    for raw_line in transcript_block.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        speaker, text = m.group(1), m.group(2).strip()
        lines.append((speaker, text))
    return lines


async def synth_line(text: str, voice: str, out_path: Path) -> None:
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(out_path))


async def main_async(md_path: Path) -> Path:
    md = md_path.read_text(encoding="utf-8")
    fm_m = FRONT_MATTER_RE.match(md)
    if not fm_m:
        raise ValueError("missing '---' front matter block")
    fm = parse_front_matter(fm_m.group(1))
    lines = parse_transcript_lines(md)
    if not lines:
        raise ValueError("no transcript lines found under '## TRANSCRIPT'")

    silence = AudioSegment.silent(duration=SILENCE_MS)
    combined = AudioSegment.empty()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for i, (speaker, text) in enumerate(lines):
            voice = fm["voices"].get(speaker)
            if not voice:
                raise ValueError(
                    f"no voice mapped for speaker '{speaker}' in front matter "
                    f"(line {i + 1}: {text[:40]!r})"
                )
            seg_path = tmp / f"line_{i:03d}.mp3"
            print(f"[tts] {i + 1}/{len(lines)} ({speaker} -> {voice}): {text[:70]!r}")
            await synth_line(text, voice, seg_path)
            seg = AudioSegment.from_file(seg_path, format="mp3")
            combined += seg
            if i < len(lines) - 1:
                combined += silence

    # This script lives at web/scripts/tts/generate_audio.py -> parents[2] is web/.
    web_root = Path(__file__).resolve().parents[2]
    out_dir = web_root / "public" / "audio" / "listening"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{fm['slug']}.mp3"

    combined = combined.set_channels(1)
    combined.export(str(out_path), format="mp3", bitrate="48k")

    duration_sec = len(combined) / 1000.0
    size_kb = out_path.stat().st_size / 1024.0
    print(
        f"[tts] wrote {out_path} "
        f"duration={duration_sec:.1f}s ({duration_sec / 60:.2f} min) size={size_kb:.0f}KB"
    )
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("md_path", type=Path, help="path to a content/listening/*.md file")
    args = parser.parse_args()
    try:
        asyncio.run(main_async(args.md_path))
    except Exception as exc:  # noqa: BLE001 - top-level CLI error reporting
        print(f"[tts] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
