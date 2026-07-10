import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "web";

export const LessonCard = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Bài 12 — Thì hiện tại hoàn thành</CardTitle>
      <CardDescription>Ngữ pháp · trình độ B1</CardDescription>
      <CardAction>
        <Button size="xs" variant="ghost">
          Lưu
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      Học cách dùng <em>present perfect</em> để nói về trải nghiệm và hành động
      vừa kết thúc.
    </CardContent>
    <CardFooter>
      <Button size="sm">Vào học</Button>
    </CardFooter>
  </Card>
);

export const Compact = () => (
  <Card size="sm" className="w-72">
    <CardHeader>
      <CardTitle>Từ vựng hôm nay</CardTitle>
      <CardDescription>18 từ cần ôn lại</CardDescription>
    </CardHeader>
    <CardContent>Ôn tập nhanh trước khi làm bài kiểm tra cuối phase.</CardContent>
  </Card>
);

export const Stat = () => (
  <Card className="w-64">
    <CardHeader>
      <CardDescription>Chuỗi ngày học</CardDescription>
      <CardTitle className="text-2xl">7 ngày liên tiếp</CardTitle>
    </CardHeader>
    <CardContent className="text-muted-foreground">
      Giữ chuỗi để mở khoá huy hiệu tuần.
    </CardContent>
  </Card>
);
