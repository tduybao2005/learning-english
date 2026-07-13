#!/usr/bin/env python3
"""Sinh 3 file SFX của app (chạy MỘT LẦN; output commit vào git).

    cd web && python3 scripts/make-sfx.py

Vì sao không dùng ffmpeg sine như bản đầu: sine trần không có đường bao biên độ,
không có hài âm lệch, không có đuôi vang — nghe đúng như tiếng bíp máy móc, và
người học phản hồi là "chưa đạt". Ở đây tự tổng hợp bằng stdlib nên kiểm soát
được cả ba: gảy lên rồi tắt theo hàm mũ (pluck), chồng hài âm như nhạc cụ thật,
và vài bản trễ nhỏ dần làm đuôi vang.

Ba âm do người dùng chọn sau khi nghe 9 phương án:
  correct  — marimba gỗ, 3 nốt rải C6-E6-G6 (ấm, tròn, không chói khi nghe 40 câu liên tục)
  wrong    — một tiếng trầm mềm rất ngắn (báo sai mà không phán xét)
  complete — hợp âm trưởng phồng lên (trang trọng, hợp với confetti)

Yêu cầu: python3 (stdlib) + ffmpeg (chỉ để đóng gói wav -> mp3 và chuẩn hoá
độ to về -14 LUFS; đừng hạ volume lần nữa ở phía client).
"""
import math
import os
import struct
import subprocess
import tempfile
import wave

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "sounds")


def env_pluck(t, dur, attack=0.004):
    """Gảy: lên gần như tức thì rồi tắt theo hàm mũ."""
    if t < attack:
        return t / attack
    return math.exp(-4.0 * (t - attack) / dur)


def env_swell(t, dur, attack=0.06):
    """Phồng lên rồi tắt — dùng cho hợp âm chúc mừng."""
    if t < attack:
        return t / attack
    return math.exp(-2.2 * (t - attack) / dur)


def tone(freq, dur, partials, envfn):
    """Một nốt = tổng các hài âm; hài cao tắt nhanh hơn hài thấp (như nhạc cụ thật)."""
    n = int(SR * dur)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        e = envfn(t, dur)
        s = 0.0
        for ratio, amp, pdecay in partials:
            s += amp * math.exp(-pdecay * t) * math.sin(2 * math.pi * freq * ratio * t)
        out[i] = e * s
    return out


def mix(layers):
    n = max(off + len(buf) for off, buf in layers)
    out = [0.0] * n
    for off, buf in layers:
        for i, v in enumerate(buf):
            out[off + i] += v
    return out


def reverb(buf, delay_s, decay, taps=4):
    """Đuôi vang: vài bản trễ nhỏ dần. Rẻ, nhưng đủ để âm thanh có không gian."""
    d = int(SR * delay_s)
    out = list(buf) + [0.0] * (d * taps)
    for k in range(1, taps + 1):
        g = decay**k
        for i, v in enumerate(buf):
            out[i + d * k] += v * g
    return out


def at(sec):
    return int(SR * sec)


def write_mp3(name, buf):
    peak = max(abs(v) for v in buf) or 1.0
    frames = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, v * 0.89 / peak)) * 32767)) for v in buf
    )
    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        with wave.open(tmp.name, "w") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(frames)
        mp3 = os.path.join(OUT_DIR, f"{name}.mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp.name, "-af", "loudnorm=I=-14:TP=-1.0", "-b:a", "128k", mp3],
            check=True,
            capture_output=True,
        )
    os.unlink(tmp.name)
    print(f"✓ {mp3}  ({len(buf) / SR:.2f}s)")


# (tỉ lệ hài âm, biên độ, tốc độ tắt của hài đó)
MARIMBA = [(1.0, 1.0, 3.0), (4.0, 0.28, 6.5), (10.0, 0.06, 10.0)]
THUMP = [(1.0, 1.0, 7.0), (2.0, 0.30, 12.0)]
CHORD = [(1.0, 1.0, 1.2), (2.0, 0.45, 2.0), (3.0, 0.22, 3.0), (4.0, 0.10, 4.0)]

correct = reverb(
    mix([
        (0, tone(1047, 0.34, MARIMBA, env_pluck)),          # C6
        (at(0.06), tone(1319, 0.34, MARIMBA, env_pluck)),   # E6
        (at(0.12), tone(1568, 0.50, MARIMBA, env_pluck)),   # G6
    ]),
    delay_s=0.04,
    decay=0.22,
)

wrong = reverb(
    mix([(0, tone(146, 0.30, THUMP, env_pluck))]),          # D3
    delay_s=0.03,
    decay=0.16,
)

complete = reverb(
    mix([
        (0, tone(523, 1.5, CHORD, env_swell)),              # C5
        (0, tone(659, 1.5, CHORD, env_swell)),              # E5
        (0, tone(784, 1.5, CHORD, env_swell)),              # G5
        (at(0.20), tone(1047, 1.4, CHORD, env_swell)),      # C6
    ]),
    delay_s=0.08,
    decay=0.40,
    taps=5,
)

if __name__ == "__main__":
    write_mp3("correct", correct)
    write_mp3("wrong", wrong)
    write_mp3("complete", complete)
