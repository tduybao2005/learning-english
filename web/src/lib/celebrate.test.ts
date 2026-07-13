// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";

// `vi.mock` được hoist lên đầu file — mock phải tạo qua `vi.hoisted`.
const { confetti, playSfx } = vi.hoisted(() => ({ confetti: vi.fn(), playSfx: vi.fn() }));
vi.mock("canvas-confetti", () => ({ default: confetti }));
vi.mock("@/lib/audio/sfx", () => ({ playSfx }));

import { celebrate } from "@/lib/celebrate";

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })),
  );
}

beforeEach(() => {
  confetti.mockClear();
  playSfx.mockClear();
});

test("bắn confetti và phát fanfare khi không bật reduced-motion", () => {
  stubReducedMotion(false);
  celebrate();
  expect(confetti).toHaveBeenCalled();
  expect(playSfx).toHaveBeenCalledWith("complete");
});

test("bỏ confetti nhưng vẫn phát fanfare khi bật reduced-motion", () => {
  stubReducedMotion(true);
  celebrate();
  expect(confetti).not.toHaveBeenCalled();
  expect(playSfx).toHaveBeenCalledWith("complete");
});
