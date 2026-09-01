// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playWordAudio, __resetWordAudioForTests } from "@/lib/audio/word-audio";

type FakeAudio = {
  src: string;
  currentTime: number;
  preload: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
};

let created: FakeAudio[] = [];

beforeEach(() => {
  created = [];
  __resetWordAudioForTests();
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      preload = "";
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
      constructor(src: string) {
        this.src = src;
        created.push(this as unknown as FakeAudio);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("phát file phát âm kèm query version", () => {
  playWordAudio("/audio/vocab/bread.mp3");

  expect(created).toHaveLength(1);
  expect(created[0].src).toBe("/audio/vocab/bread.mp3?v=2");
  expect(created[0].play).toHaveBeenCalledTimes(1);
});

test("dùng lại cùng một element khi phát lại đúng từ đó", () => {
  playWordAudio("/audio/vocab/bread.mp3");
  playWordAudio("/audio/vocab/bread.mp3");

  expect(created).toHaveLength(1);
  expect(created[0].play).toHaveBeenCalledTimes(2);
});

test("từ mới thì cắt ngang từ đang đọc dở", () => {
  playWordAudio("/audio/vocab/bread.mp3");
  playWordAudio("/audio/vocab/milk.mp3");

  expect(created).toHaveLength(2);
  expect(created[0].pause).toHaveBeenCalledTimes(1);
  expect(created[1].play).toHaveBeenCalledTimes(1);
});

test("src rỗng thì im lặng, không dựng Audio nào", () => {
  playWordAudio(null);
  playWordAudio(undefined);
  playWordAudio("");

  expect(created).toHaveLength(0);
});

test("nuốt lỗi khi trình duyệt chặn autoplay", () => {
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        throw new Error("blocked");
      }
    },
  );

  expect(() => playWordAudio("/audio/vocab/bread.mp3")).not.toThrow();
});
