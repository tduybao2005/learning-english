#!/usr/bin/env bash
# Sinh 3 file SFX bằng ffmpeg (chạy MỘT LẦN, output được commit vào git).
# Tự tổng hợp bằng sine wave => không phụ thuộc asset ngoài, không vướng license.
set -euo pipefail
out="$(dirname "$0")/../public/sounds"
mkdir -p "$out"

# correct: hai nốt đi lên (C6 -> E6), ngắn, vui
ffmpeg -y -f lavfi -i "sine=frequency=1047:duration=0.09" \
       -f lavfi -i "sine=frequency=1319:duration=0.16" \
       -filter_complex "[0][1]concat=n=2:v=0:a=1,afade=t=out:st=0.16:d=0.09,volume=0.35" \
       -b:a 96k "$out/correct.mp3"

# wrong: một nốt trầm ngắn (A3), không chói tai
ffmpeg -y -f lavfi -i "sine=frequency=220:duration=0.22" \
       -af "afade=t=out:st=0.12:d=0.10,volume=0.30" \
       -b:a 96k "$out/wrong.mp3"

# complete: fanfare 4 nốt (C6-E6-G6-C7)
ffmpeg -y -f lavfi -i "sine=frequency=1047:duration=0.12" \
       -f lavfi -i "sine=frequency=1319:duration=0.12" \
       -f lavfi -i "sine=frequency=1568:duration=0.12" \
       -f lavfi -i "sine=frequency=2093:duration=0.40" \
       -filter_complex "[0][1][2][3]concat=n=4:v=0:a=1,afade=t=out:st=0.55:d=0.21,volume=0.35" \
       -b:a 96k "$out/complete.mp3"

echo "OK -> $out"
