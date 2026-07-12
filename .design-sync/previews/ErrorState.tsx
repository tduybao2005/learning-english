import { ErrorState } from "web";

// The caption is not decoration: ErrorState's icon tile is a "⚠️" emoji, and
// package-validate.mjs treats a cell whose text starts with ⚠ as a caught render
// error (same trap as AnswerKeyAccordion). Leading with a label keeps that
// heuristic from firing on legitimate content.
//
// `linkComponent="a"` is the design-time link — same markup, no Next navigation.
export const Default = () => (
  <div className="w-[36rem] space-y-2">
    <p className="text-caption text-muted-foreground">Trạng thái lỗi mặc định</p>
    <ErrorState reset={() => {}} linkComponent="a" />
  </div>
);

export const CustomCopy = () => (
  <div className="w-[36rem] space-y-2">
    <p className="text-caption text-muted-foreground">Lỗi có nội dung riêng</p>
    <ErrorState
      title="Không tải được bài nghe"
      description="Máy chủ không phản hồi. Kiểm tra kết nối mạng rồi thử lại nhé."
      reset={() => {}}
      linkComponent="a"
    />
  </div>
);
