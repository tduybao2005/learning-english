import { Button } from "web";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="default">Bắt đầu học</Button>
    <Button variant="accent">Luyện tập ngay</Button>
    <Button variant="success">Hoàn thành bài</Button>
    <Button variant="secondary">Để sau</Button>
    <Button variant="outline">Xem đáp án</Button>
    <Button variant="ghost">Bỏ qua</Button>
    <Button variant="destructive">Đặt lại tiến độ</Button>
    <Button variant="link">Chi tiết</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="xs">Rất nhỏ</Button>
    <Button size="sm">Nhỏ</Button>
    <Button size="default">Mặc định</Button>
    <Button size="lg">Lớn</Button>
  </div>
);

export const States = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Nộp bài</Button>
    <Button disabled>Đang chấm…</Button>
    <Button variant="outline" disabled>
      Chưa mở khoá
    </Button>
  </div>
);
