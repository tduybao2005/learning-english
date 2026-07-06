"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SPEEDS = [0.75, 1, 1.25] as const;
type Speed = (typeof SPEEDS)[number];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Audio player wrapping a native `<audio>` element with shadcn-styled
 * controls: play/pause, ±10s seek buttons, a seek bar, and a 0.75/1/1.25
 * speed picker. Kept as a thin controller over the native element (no custom
 * audio engine) — `<audio>` already handles buffering/streaming/decoding.
 *
 * Two visual variants share the same playback logic/state/refs:
 * - `"compact"` (default): Task 10's pale card look, used by the placement
 *   wizard.
 * - `"full"`: a fully primary-colored card used by the listening hub pages
 *   (Task 12), with a custom progress track and larger controls.
 */
export function AudioPlayer({
  src,
  variant = "compact",
}: {
  src: string;
  variant?: "compact" | "full";
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
    setPlaying(!playing);
  }

  function seekBy(deltaSec: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const max = duration || audio.duration || 0;
    audio.currentTime = Math.min(Math.max(audio.currentTime + deltaSec, 0), max);
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  }

  function changeSpeed(next: Speed) {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = next;
    setSpeed(next);
  }

  if (variant === "full") {
    const percent = duration > 0 ? Math.min((current / duration) * 100, 100) : 0;

    function handleTrackClick(e: MouseEvent<HTMLDivElement>) {
      if (!duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      seekTo(ratio * duration);
    }

    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-primary-glow">
        <audio ref={audioRef} src={src} preload="metadata" />

        <div className="flex flex-col gap-1.5">
          <div
            role="slider"
            aria-label="Tua bài nghe"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={Math.min(current, duration || 0)}
            onClick={handleTrackClick}
            className="h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/25"
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex items-center justify-between font-mono text-xs opacity-80">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => seekBy(-10)}
            aria-label="Lùi 10 giây"
            className="flex size-9 items-center justify-center rounded-full bg-white/15"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Tạm dừng" : "Phát"}
            className="flex size-14 items-center justify-center rounded-full bg-white text-primary"
          >
            {playing ? <Pause className="size-6" /> : <Play className="size-6" />}
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            aria-label="Tiến 10 giây"
            className="flex size-9 items-center justify-center rounded-full bg-white/15"
          >
            <RotateCw className="size-4" />
          </button>
        </div>

        <div className="flex justify-center gap-1.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              aria-pressed={speed === s}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
                speed === s ? "bg-white text-primary" : "bg-white/15 text-primary-foreground/90",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-secondary/50 p-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="icon-lg"
          className="rounded-full"
          onClick={togglePlay}
          aria-label={playing ? "Tạm dừng" : "Phát"}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon" variant="outline" onClick={() => seekBy(-10)} aria-label="Lùi 10 giây">
          <RotateCcw />
        </Button>
        <Button size="icon" variant="outline" onClick={() => seekBy(10)} aria-label="Tiến 10 giây">
          <RotateCw />
        </Button>

        <div className="flex min-w-[10rem] flex-1 items-center gap-2 text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(current)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(current, duration || 0)}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Tua bài nghe"
            className="h-1.5 flex-1 accent-primary"
          />
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              aria-pressed={speed === s}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                speed === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <p className="text-caption text-muted-foreground">🎧 Bạn có thể nghe lại nhiều lần</p>
    </div>
  );
}
