import { ListeningBottomNav } from "web";

// The bar is `fixed inset-x-0 bottom-0`: in the app it pins to the viewport,
// escaping the <main lg:pl-[232px]> frame. In a preview cell that made it clip
// against the cell's top edge, so each story is wrapped in a `transform`ed box —
// a transform creates a containing block for `fixed`, which pins the bar to the
// bottom of THIS frame instead. Purely a preview device; do not copy it into a
// screen design.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    className="relative w-[44rem] rounded-xl border border-border bg-muted/40"
    style={{ height: "9rem", transform: "translateZ(0)" }}
  >
    <p className="p-4 text-caption text-muted-foreground">…nội dung trang bài nghe…</p>
    {children}
  </div>
);

export const Default = () => (
  <Frame>
    <ListeningBottomNav linkComponent="a" />
  </Frame>
);

export const WithSubtitle = () => (
  <Frame>
    <ListeningBottomNav linkComponent="a" subtitle="Phần 2/4" />
  </Frame>
);
