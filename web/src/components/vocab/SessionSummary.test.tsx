// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { SessionSummary } from "@/components/vocab/SessionSummary";

function renderSummary(props: Partial<React.ComponentProps<typeof SessionSummary>> = {}) {
  return render(
    <SessionSummary
      title="Hoàn thành phiên học!"
      correct={9}
      total={10}
      saveState="idle"
      restartLabel="Học lại"
      onRestart={() => {}}
      backHref="/vocab"
      linkComponent="a"
      {...props}
    />,
  );
}

test("xếp hạng Xuất sắc khi đúng từ 90% trở lên", () => {
  renderSummary({ correct: 9, total: 10 });
  expect(screen.getByText("Xuất sắc")).toBeTruthy();
});

test("xếp hạng Cần ôn lại khi đúng dưới 70%", () => {
  renderSummary({ correct: 5, total: 10 });
  expect(screen.getByText("Cần ôn lại")).toBeTruthy();
});

test("hiện số câu đúng trên tổng số", () => {
  renderSummary({ correct: 7, total: 10 });
  expect(screen.getByTestId("summary-correct").textContent).toBe("7");
  expect(screen.getByTestId("summary-total").textContent).toContain("10");
});

test("hiện các số liệu phụ do từng game truyền vào", () => {
  renderSummary({
    extraStats: [
      { label: "Chuỗi đúng dài nhất", value: "7" },
      { label: "Thời gian", value: "1:23" },
    ],
  });
  expect(screen.getByText("Chuỗi đúng dài nhất")).toBeTruthy();
  expect(screen.getByText("7")).toBeTruthy();
  expect(screen.getByText("Thời gian")).toBeTruthy();
  expect(screen.getByText("1:23")).toBeTruthy();
});

test("báo đang lưu / đã lưu / lỗi lưu tiến độ", () => {
  const { rerender } = renderSummary({ saveState: "saving" });
  expect(screen.getByText(/Đang lưu tiến độ/)).toBeTruthy();

  rerender(
    <SessionSummary
      title="x"
      correct={1}
      total={1}
      saveState="saved"
      restartLabel="Học lại"
      onRestart={() => {}}
      backHref="/vocab"
      linkComponent="a"
    />,
  );
  expect(screen.getByText(/Đã lưu tiến độ/)).toBeTruthy();

  rerender(
    <SessionSummary
      title="x"
      correct={1}
      total={1}
      saveState="error"
      restartLabel="Học lại"
      onRestart={() => {}}
      backHref="/vocab"
      linkComponent="a"
    />,
  );
  expect(screen.getByText(/Không thể lưu tiến độ/)).toBeTruthy();
});

test("bấm nút làm lại gọi đúng callback", () => {
  const onRestart = vi.fn();
  renderSummary({ onRestart, restartLabel: "Chơi lại" });
  fireEvent.click(screen.getByRole("button", { name: "Chơi lại" }));
  expect(onRestart).toHaveBeenCalledTimes(1);
});

test("link quay lại trỏ đúng địa chỉ được truyền vào", () => {
  renderSummary({ backHref: "/vocab/food-drink" });
  const link = screen.getByRole("link", { name: /Quay lại/ });
  expect(link.getAttribute("href")).toBe("/vocab/food-drink");
});

test("phiên rỗng không chia cho 0 và vẫn xếp hạng được", () => {
  renderSummary({ correct: 0, total: 0 });
  expect(screen.getByText("Cần ôn lại")).toBeTruthy();
});
