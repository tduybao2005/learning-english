import { MobileTabBar } from "web";

// The bar is `fixed inset-x-0 bottom-0`: in the app it pins to the viewport.
// In a preview cell that made it clip, so each story is wrapped in a `transform`ed
// box — a transform creates a containing block for `fixed`, pinning the bar to the
// bottom of THIS frame. Purely a preview device; do not copy it into a screen design.
// The bar is also `lg:hidden` in the app (at ≥1024px AppSidebar takes over). Preview
// cards are captured at 1200px wide, so without `className="lg:block!"` every story
// would render as an EMPTY card. Both the transform frame and that class are preview
// devices only — in a real screen the bar is phone/tablet-only.
const Phone = ({ children }: { children: React.ReactNode }) => (
  <div
    className="relative w-[23.4375rem] rounded-xl border border-border bg-muted/40"
    style={{ height: "16rem", transform: "translateZ(0)" }}
  >
    <p className="p-4 text-caption text-muted-foreground">…nội dung trang…</p>
    {children}
  </div>
);

export const DashboardActive = () => (
  <Phone>
    <MobileTabBar linkComponent="a" activePath="/dashboard" className="lg:block!" />
  </Phone>
);

export const ListeningActive = () => (
  <Phone>
    <MobileTabBar linkComponent="a" activePath="/listening/bai-01" className="lg:block!" />
  </Phone>
);

export const IeltsActive = () => (
  <Phone>
    <MobileTabBar linkComponent="a" activePath="/ielts" className="lg:block!" />
  </Phone>
);

export const SettingsActive = () => (
  <Phone>
    <MobileTabBar linkComponent="a" activePath="/settings" className="lg:block!" />
  </Phone>
);
