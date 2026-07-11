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
# `[PAUSE:n]` on its own line -> n seconds of silence instead of a synthesized
# turn (e.g. section reading/answer time). Kept in sync by hand with
# `scripts/seed/parse-listening.ts`'s PAUSE_LINE_RE (that side strips these
# lines from the stored transcript; this side turns them into audio).
PAUSE_RE = re.compile(r"^\[PAUSE:(\d+(?:\.\d+)?)\]$")
PAUSE_SPEAKER = "__PAUSE__"
SILENCE_MS = 400
TTS_RETRY_ATTEMPTS = 3
TTS_RETRY_BACKOFF_SEC = 2.0
# Mirrors web/src/lib/transcript.ts SECTION_MARKER_RE — kept in sync by hand
# (one is TS, one is Python). A line "NARRATOR: Section N. ..." marks the
# start of section N; the preamble before marker 1 joins section 1.
SECTION_MARKER_RE = re.compile(r"^Section\s+(\d+)\b")


def split_lines_into_sections(
    lines: list[tuple[str, str]]
) -> list[list[tuple[str, str]]] | None:
    """Group parsed transcript lines into per-section chunks, mirroring
    `transcriptChunksForSections` in transcript.ts. Returns None (meaning:
    don't split) unless every marker is present, numbered cleanly 1..N with
    no gaps/duplicates, in order."""
    markers: list[tuple[int, int]] = []  # (line index, section number)
    for i, (speaker, text) in enumerate(lines):
        if speaker != "NARRATOR":
            continue
        m = SECTION_MARKER_RE.match(text)
        if m:
            markers.append((i, int(m.group(1))))

    if not markers:
        return None
    if [num for _, num in markers] != list(range(1, len(markers) + 1)):
        return None

    groups: list[list[tuple[str, str]]] = []
    for gi, (line_idx, _num) in enumerate(markers):
        start = 0 if gi == 0 else line_idx
        end = markers[gi + 1][0] if gi + 1 < len(markers) else len(lines)
        groups.append(lines[start:end])
    return groups


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
        pause_m = PAUSE_RE.match(line)
        if pause_m:
            lines.append((PAUSE_SPEAKER, pause_m.group(1)))
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        speaker, text = m.group(1), m.group(2).strip()
        lines.append((speaker, text))
    return lines


async def synth_line(text: str, voice: str, out_path: Path) -> None:
    """Synthesize one line, retrying on transient edge-tts/network failures —
    important for a ~40-45 minute TOEIC file with hundreds of lines, where a
    single flaky request would otherwise abort the whole run."""
    last_exc: Exception | None = None
    for attempt in range(1, TTS_RETRY_ATTEMPTS + 1):
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(out_path))
            return
        except Exception as exc:  # noqa: BLE001 - retry any transient failure
            last_exc = exc
            if attempt < TTS_RETRY_ATTEMPTS:
                print(f"[tts] retry {attempt}/{TTS_RETRY_ATTEMPTS - 1} after error: {exc}", file=sys.stderr)
                await asyncio.sleep(TTS_RETRY_BACKOFF_SEC * attempt)
    assert last_exc is not None
    raise last_exc


def print_dry_run_plan(fm: dict, lines: list[tuple[str, str]]) -> None:
    print(f"[tts] dry-run plan for slug={fm['slug']!r} ({len(lines)} lines):")
    total_pause_sec = 0.0
    for i, (speaker, text) in enumerate(lines):
        if speaker == PAUSE_SPEAKER:
            total_pause_sec += float(text)
            print(f"  {i + 1:>4}. [PAUSE {text}s]")
            continue
        voice = fm["voices"].get(speaker)
        voice_str = voice if voice else "!! NO VOICE MAPPED !!"
        print(f"  {i + 1:>4}. {speaker} -> {voice_str}: {text[:70]!r}")
    missing = {
        speaker
        for speaker, text in lines
        if speaker != PAUSE_SPEAKER and not fm["voices"].get(speaker)
    }
    if missing:
        raise ValueError(f"no voice mapped for speaker(s): {sorted(missing)}")
    print(f"[tts] total scripted pause time: {total_pause_sec:.1f}s")

    groups = split_lines_into_sections(lines)
    if groups is None:
        print("[tts] not split into sections (no clean Section markers)")
    else:
        print(f"[tts] would split into {len(groups)} section(s):")
        for i, group in enumerate(groups, start=1):
            print(f"  section {i}: {len(group)} line(s) -> {fm['slug']}_s{i}.mp3")


async def main_async(md_path: Path, dry_run: bool = False) -> Path | None:
    md = md_path.read_text(encoding="utf-8")
    fm_m = FRONT_MATTER_RE.match(md)
    if not fm_m:
        raise ValueError("missing '---' front matter block")
    fm = parse_front_matter(fm_m.group(1))
    lines = parse_transcript_lines(md)
    if not lines:
        raise ValueError("no transcript lines found under '## TRANSCRIPT'")

    if dry_run:
        print_dry_run_plan(fm, lines)
        return None

    silence = AudioSegment.silent(duration=SILENCE_MS)
    segments: list[AudioSegment] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for i, (speaker, text) in enumerate(lines):
            if speaker == PAUSE_SPEAKER:
                print(f"[tts] {i + 1}/{len(lines)} [PAUSE {text}s]")
                segments.append(AudioSegment.silent(duration=int(float(text) * 1000)))
                continue
            voice = fm["voices"].get(speaker)
            if not voice:
                raise ValueError(
                    f"no voice mapped for speaker '{speaker}' in front matter "
                    f"(line {i + 1}: {text[:40]!r})"
                )
            seg_path = tmp / f"line_{i:03d}.mp3"
            print(f"[tts] {i + 1}/{len(lines)} ({speaker} -> {voice}): {text[:70]!r}")
            await synth_line(text, voice, seg_path)
            segments.append(AudioSegment.from_file(seg_path, format="mp3"))

    def join(segs: list[AudioSegment]) -> AudioSegment:
        out = AudioSegment.empty()
        for i, seg in enumerate(segs):
            out += seg
            if i < len(segs) - 1:
                out += silence
        return out.set_channels(1)

    def export(seg: AudioSegment, out_path: Path) -> None:
        seg.export(str(out_path), format="mp3", bitrate="48k")
        duration_sec = len(seg) / 1000.0
        size_kb = out_path.stat().st_size / 1024.0
        print(
            f"[tts] wrote {out_path} "
            f"duration={duration_sec:.1f}s ({duration_sec / 60:.2f} min) size={size_kb:.0f}KB"
        )

    # This script lives at web/scripts/tts/generate_audio.py -> parents[2] is web/.
    web_root = Path(__file__).resolve().parents[2]
    out_dir = web_root / "public" / "audio" / "listening"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{fm['slug']}.mp3"

    combined = join(segments)
    export(combined, out_path)

    groups = split_lines_into_sections(lines)
    if groups is None:
        print("[tts] not split into sections (no clean Section markers)")
    else:
        # Recompute segment boundaries the same way split_lines_into_sections
        # partitioned `lines`, so we reuse the already-synthesized `segments`
        # without re-synthesizing anything.
        idx = 0
        for i, group in enumerate(groups, start=1):
            group_segs = segments[idx : idx + len(group)]
            idx += len(group)
            section_seg = join(group_segs)
            section_path = out_dir / f"{fm['slug']}_s{i}.mp3"
            export(section_seg, section_path)

    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("md_path", type=Path, help="path to a content/listening/*.md file")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="parse and print the synthesis plan (speaker/voice/pause per line) without synthesizing any audio",
    )
    args = parser.parse_args()
    try:
        asyncio.run(main_async(args.md_path, dry_run=args.dry_run))
    except Exception as exc:  # noqa: BLE001 - top-level CLI error reporting
        print(f"[tts] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
