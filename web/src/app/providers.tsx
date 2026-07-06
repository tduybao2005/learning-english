"use client";

import { ThemeProvider } from "next-themes";

/** Client-side app providers. next-themes stamps `class="dark"` on <html>
 * (matching globals.css's `@custom-variant dark`), follows the OS by
 * default, and persists an explicit user choice from the settings toggle. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
