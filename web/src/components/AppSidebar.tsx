"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Headphones, GraduationCap, Settings } from "lucide-react";

import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Lộ trình", icon: Home },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/ielts", label: "Đề IELTS", icon: GraduationCap },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

/** Fixed left sidebar for the ≥1024px desktop shell (design doc §13): logo,
 * vertical nav, logout pinned at the bottom. Hidden below `lg:`, where
 * `AppHeader`'s horizontal nav is the only nav surface — the two never render
 * at the same time. Client component: active-route highlighting needs
 * `usePathname()`. */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-border bg-card lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          H
        </span>
        <span className="text-sm font-bold tracking-tight">Học tiếng Anh</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <LogoutButton variant="ghost" className="w-full" />
      </div>
    </aside>
  );
}
