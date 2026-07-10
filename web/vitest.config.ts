import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors tsconfig's `"@/*": ["./src/*"]`. Not needed by earlier tests
    // (they either import relatively or mock "@/lib/db" wholesale, which
    // vitest can intercept without ever resolving the real path), but
    // Task 9's integration test imports real modules — route handlers,
    // `db`, `matchAnswer`, `getNextLesson` — via "@/..." specifiers.
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // tsconfig sets jsx:"preserve" for Next; vitest needs a real transform.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
