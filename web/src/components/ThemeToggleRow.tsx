"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Switch } from "@/components/ui/switch";

/** Settings row toggling dark mode. Renders the switch only after mount:
 * the server doesn't know the stored theme, so this avoids a hydration
 * mismatch on `checked`. */
export function ThemeToggleRow() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-secondary text-base">
          🌙
        </span>
        <p className="text-sm font-semibold">Giao diện tối</p>
      </div>
      {mounted ? (
        <Switch
          checked={resolvedTheme === "dark"}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          aria-label="Bật giao diện tối"
        />
      ) : null}
    </div>
  );
}
