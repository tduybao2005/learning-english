// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { LevelBadge } from "@/components/LevelBadge";

test("hiển thị mã cấp độ và nhãn tiếng Việt", () => {
  render(<LevelBadge level="B1" />);
  expect(screen.getByText(/B1/)).toBeDefined();
  expect(screen.getByText(/Trung cấp/)).toBeDefined();
});
