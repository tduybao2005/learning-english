import Link from "next/link";
import { Home, Headphones, GraduationCap, Settings } from "lucide-react";

import { LogoutButton } from "@/components/LogoutButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/ielts", label: "IELTS", icon: GraduationCap },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

/** App-wide nav header for every authenticated `(app)` route: links to the
 * dashboard, listening hub, IELTS hub and settings, plus logout — the only
 * place in the UI these hubs (and the new settings page) are reachable from
 * without typing a URL directly. Horizontally scrollable on narrow viewports
 * instead of wrapping, so it never grows past one line on mobile. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto px-4 py-3">
        <Link href="/dashboard" className="mr-2 shrink-0 text-sm font-bold tracking-tight">
          Học tiếng Anh
        </Link>

        <nav className="flex shrink-0 items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto shrink-0 pl-2">
          <LogoutButton variant="ghost" />
        </div>
      </div>
    </header>
  );
}
