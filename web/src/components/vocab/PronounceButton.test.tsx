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
  expect(created).toEqual(["/audio/vocab/take-off.mp3"]);
  expect(play).toHaveBeenCalledTimes(1);
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
