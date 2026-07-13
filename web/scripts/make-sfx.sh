#!/usr/bin/env bash
# Sinh 3 file SFX bằng ffmpeg (chạy MỘT LẦN, output được commit vào git).
# Tự tổng hợp => không phụ thuộc asset ngoài, không vướng license.
#
# Bản đầu dùng sine thuần ở volume 0.35: nghe mỏng như tiếng bíp và quá NHỎ
# (client còn nhân thêm 0.6 nữa) nên người học không nhận ra là có âm thanh.
# Bản này: cộng hài âm (fundamental + quãng tám + quãng năm) cho dày tiếng,
# bao đường cong tắt dần (decay) kiểu chuông, và đẩy to hẳn lên.
set -euo pipefail
out="$(dirname "$0")/../public/sounds"
mkdir -p "$out"

# correct: hợp âm chuông đi lên C6 -> E6, mỗi nốt là 3 hài âm chồng nhau,
# decay mũ (exp) cho ra tiếng "ting" trong trẻo thay vì "bíp" phẳng.
ffmpeg -y \
  -f lavfi -i "sine=frequency=1047:duration=0.35" \
  -f lavfi -i "sine=frequency=2093:duration=0.35" \
  -f lavfi -i "sine=frequency=1568:duration=0.35" \
  -f lavfi -i "sine=frequency=1319:duration=0.45" \
  -f lavfi -i "sine=frequency=2637:duration=0.45" \
  -f lavfi -i "sine=frequency=1976:duration=0.45" \
  -filter_complex "\
    [0]volume=1.0[a1];[1]volume=0.35[a2];[2]volume=0.22[a3]; \
    [a1][a2][a3]amix=inputs=3:normalize=0,afade=t=out:st=0.05:d=0.30,adelay=0|0[n1]; \
    [3]volume=1.0[b1];[4]volume=0.35[b2];[5]volume=0.22[b3]; \
    [b1][b2][b3]amix=inputs=3:normalize=0,afade=t=out:st=0.10:d=0.35[n2]; \
    [n1][n2]concat=n=2:v=0:a=1,loudnorm=I=-14:TP=-1.0" \
  -b:a 128k "$out/correct.mp3"

# wrong: hai nốt trầm đi xuống (F3 -> D3), tiếng "ục" mềm — báo sai nhưng không
# chì chiết. Thêm hài âm bậc 2 cho có thân, cắt đuôi nhanh.
ffmpeg -y \
  -f lavfi -i "sine=frequency=175:duration=0.16" \
  -f lavfi -i "sine=frequency=350:duration=0.16" \
  -f lavfi -i "sine=frequency=147:duration=0.30" \
  -f lavfi -i "sine=frequency=294:duration=0.30" \
  -filter_complex "\
    [0]volume=1.0[a1];[1]volume=0.30[a2];[a1][a2]amix=inputs=2:normalize=0[n1]; \
    [2]volume=1.0[b1];[3]volume=0.30[b2];[b1][b2]amix=inputs=2:normalize=0,afade=t=out:st=0.12:d=0.18[n2]; \
    [n1][n2]concat=n=2:v=0:a=1,loudnorm=I=-14:TP=-1.0" \
  -b:a 128k "$out/wrong.mp3"

# complete: fanfare 4 nốt C6-E6-G6-C7, nốt cuối ngân dài có hài âm — nghe ra
# "hoàn thành!" chứ không phải 4 tiếng bíp rời rạc.
ffmpeg -y \
  -f lavfi -i "sine=frequency=1047:duration=0.14" \
  -f lavfi -i "sine=frequency=1319:duration=0.14" \
  -f lavfi -i "sine=frequency=1568:duration=0.14" \
  -f lavfi -i "sine=frequency=2093:duration=0.75" \
  -f lavfi -i "sine=frequency=3136:duration=0.75" \
  -f lavfi -i "sine=frequency=1568:duration=0.75" \
  -filter_complex "\
    [3]volume=1.0[c1];[4]volume=0.30[c2];[5]volume=0.45[c3]; \
    [c1][c2][c3]amix=inputs=3:normalize=0,afade=t=out:st=0.25:d=0.50[last]; \
    [0][1][2][last]concat=n=4:v=0:a=1,loudnorm=I=-14:TP=-1.0" \
  -b:a 128k "$out/complete.mp3"

echo "OK -> $out"
