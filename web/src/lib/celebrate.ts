"use client";

import confetti from "canvas-confetti";

import { playSfx } from "@/lib/audio/sfx";

/**
 * Ăn mừng khi hoàn thành bài tập: confetti + fanfare.
 * Âm thanh luôn phát (đó là phản hồi, không phải chuyển động); confetti bị bỏ
 * qua nếu người dùng đặt `prefers-reduced-motion: reduce`.
 */
export function celebrate(): void {
  if (typeof window === "undefined") return;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (!reduced) {
    // Hai chùm bắn chéo từ hai mép dưới — đọc rõ trên cả màn hình điện thoại.
    const shared = { particleCount: 60, spread: 70, startVelocity: 45, ticks: 160 };
    confetti({ ...shared, origin: { x: 0.15, y: 0.9 }, angle: 60 });
    confetti({ ...shared, origin: { x: 0.85, y: 0.9 }, angle: 120 });
  }
  playSfx("complete");
}
