// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { PronounceButton } from "@/components/vocab/PronounceButton";

const play = vi.fn(() => Promise.resolve());
let created: string[] = [];

beforeEach(() => {
  play.mockClear();
  created = [];
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      constructor(src: string) {
        this.src = src;
        created.push(src);
      }
      play = play;
    },
  );
});

test("phát đúng file được truyền vào", () => {
  render(<PronounceButton src="/audio/vocab/take-off.mp3" label="Take off" />);
  fireEvent.click(screen.getByRole("button", { name: /Phát âm/ }));
  // URL kèm `?v=` để phá cache khi đổi giọng — xem VOICE_VERSION.
  expect(created).toEqual(["/audio/vocab/take-off.mp3?v=2"]);
  expect(play).toHaveBeenCalledTimes(1);
});

test("đổi sang từ khác thì phát file của từ MỚI, không phát lại file cũ", () => {
  const { rerender } = render(<PronounceButton src="/audio/vocab/wake-up.mp3" label="wake up" />);
  fireEvent.click(screen.getByRole("button", { name: /Phát âm/ }));

  // Cùng một instance component (không remount) — chỉ prop `src` đổi, đúng như
  // khi Flashcards sang thẻ tiếp theo.
  rerender(<PronounceButton src="/audio/vocab/brush.mp3" label="brush" />);
  fireEvent.click(screen.getByRole("button", { name: /Phát âm/ }));

  expect(created).toEqual(["/audio/vocab/wake-up.mp3?v=2", "/audio/vocab/brush.mp3?v=2"]);
});

test("bấm không kích hoạt vùng bấm bao ngoài (chặn nổi bọt)", () => {
  const onParentClick = vi.fn();
  render(
    <div onClick={onParentClick}>
      <PronounceButton src="/audio/vocab/hello.mp3" label="hello" />
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Phát âm/ }));
  expect(onParentClick).not.toHaveBeenCalled();
});
