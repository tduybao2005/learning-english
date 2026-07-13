// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";

import { playSfx, __resetSfxCacheForTests } from "@/lib/audio/sfx";

const play = vi.fn(() => Promise.resolve());

beforeEach(() => {
  play.mockClear();
  __resetSfxCacheForTests();
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      preload = "";
      volume = 1;
      constructor(src: string) {
        this.src = src;
      }
      play = play;
    },
  );
});

test("phát đúng file cho từng tên SFX", () => {
  playSfx("correct");
  expect(play).toHaveBeenCalledTimes(1);
});

test("dùng lại cùng một element khi phát lặp lại", () => {
  playSfx("wrong");
  playSfx("wrong");
  expect(play).toHaveBeenCalledTimes(2);
});

test("nuốt lỗi khi trình duyệt chặn autoplay", () => {
  play.mockImplementationOnce(() => Promise.reject(new Error("NotAllowedError")));
  expect(() => playSfx("complete")).not.toThrow();
});
