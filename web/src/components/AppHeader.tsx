import Link from "next/link";
import { Home, Headphones, GraduationCap, Settings } from "lucide-react";

import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/utils";

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
 * instead of wrapping, so it never grows past one line on mobile. Confined to
 * `lg:hidden` by the `(app)` layout, where `AppSidebar`'s vertical nav takes
 * over — the two never render at the same time. */
export function AppHeader({ className }: { className?: string }) {
  return (
    <header className={cn("sticky top-0 z-10 border-b border-border bg-card", className)}>
      <div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto px-4 py-3">
        <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            H
          </span>
          <span className="text-sm font-bold tracking-tight">Học tiếng Anh</span>
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
