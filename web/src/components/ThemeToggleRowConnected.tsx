"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { ThemeToggleRow } from "@/components/ThemeToggleRow";

/** Theme-aware wrapper around the presentational `ThemeToggleRow`.
 *
 * The server cannot know the stored theme, so the switch reports `false`
 * until mount — server HTML and the first client render agree, and the real
 * value is applied on the effect pass. That guard belongs here, not in the
 * presentational row. */
export function ThemeToggleRowConnected() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <ThemeToggleRow
      checked={mounted && resolvedTheme === "dark"}
      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
    />
  );
}
