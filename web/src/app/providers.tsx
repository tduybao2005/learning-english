"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";

/**
 * Bật `:active` cho iOS Safari.
 *
 * Safari trên iPhone/iPad KHÔNG áp style `:active` cho phần tử thường
 * (`<a>`, `<div>`, thẻ chủ đề…) trừ khi trang có ít nhất một listener
 * `touchstart`. Thiếu dòng này thì toàn bộ hiệu ứng `press-tile`/`press-btn`
 * im lặng trên iPhone dù CSS hoàn toàn đúng — lỗi rất khó lần ra vì trên
 * Chrome desktop và Android mọi thứ vẫn chạy bình thường.
 *
 * Listener rỗng và `passive` nên không chặn cuộn, không tốn gì.
 */
function useIosActiveState() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
}

/** Client-side app providers. next-themes stamps `class="dark"` on <html>
 * (matching globals.css's `@custom-variant dark`), follows the OS by
 * default, and persists an explicit user choice from the settings toggle. */
export function Providers({ children }: { children: React.ReactNode }) {
  useIosActiveState();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
