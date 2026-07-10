import { ExplanationSlot } from "web";

export const WithExplanation = () => (
  <div className="w-96">
    <ExplanationSlot explanation="“Present perfect” dùng với 'since' + mốc thời gian, còn 'for' + khoảng thời gian. Ở đây mốc là 2019 nên phải dùng 'since'." />
  </div>
);

export const Empty = () => (
  <div className="w-96 text-sm text-muted-foreground">
    <ExplanationSlot explanation={null} />
    (Không có giải thích — component render null)
  </div>
);
