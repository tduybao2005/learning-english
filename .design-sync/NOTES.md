# design-sync notes — Học tiếng Anh

Repo-specific gotchas. Read this before any re-sync.

## Shape

- This repo is **not a design-system package**. `web/` is a Next.js 15 app. There is no
  `dist/`, no library entry, no Storybook. `shape: "package"` with `--entry ./web/.ds-entry.tsx`
  — a barrel that re-exports the six real primitives from `web/src/components/ui`. It
  reimplements nothing.
- Only `Button, Card, Input, Skeleton, Switch, Tabs` are synced (pinned via `componentSrcMap`).
  The other ~26 components in `web/src/components/` are coupled to `next/link`,
  `next/navigation`, `next-auth`, `next-themes` and Prisma-shaped props. Bundling them would
  require stubbing the framework — deliberately **out of scope**.
- Compound parts (`CardHeader`, `TabsTrigger`, …) ship in the bundle for composition but are
  not registered as components.

## Build order (mandatory)

```sh
node .design-sync/fetch-fonts.mjs    # 1. vendor woff2  -> web/.ds-css/fonts/
node .design-sync/build-css.mjs      # 2. compile CSS   -> web/.ds-css/styles.compiled.css
node .ds-sync/resync.mjs …           # 3. converter
```

- **`cfg.cssEntry` is copied verbatim — the converter never runs Tailwind.** Pointing it at
  `src/app/globals.css` would ship `@import "tailwindcss"` and every preview renders unstyled.
- **Fonts come from `next/font/google`**, so no font files exist in the repo. Without
  `fetch-fonts.mjs` every design silently falls back to a system font. The `vietnamese`
  subset is required — all UI copy is Vietnamese.
- Both output dirs (`web/.ds-css/`) are gitignored; re-run both scripts on a fresh clone.

## Tailwind v4 tree-shaking — the sharp edge

Designs receive only the **pre-compiled** `styles.css`; there is no JIT at design time.
Tailwind emits only utilities it can *see*. Therefore `build-css.mjs` carries:

- `@source` for `web/src/components/ui` (classes live inside `cva()` strings) and for
  `.design-sync/previews` (preview layout glue).
- An `@source inline(...)` **safelist** of the layout/typography/semantic-color vocabulary
  the design agent is allowed to use. `.design-sync/conventions.md` documents exactly that
  vocabulary. **The safelist and the conventions header must stay in sync** — a class in the
  header but not the safelist produces no CSS; a class in the safelist but not the header is
  never used.
- The DS has its **own type scale** from `@theme --text-*`: `text-h1`, `text-h2`, `text-body`,
  `text-caption` (tuned line-height + letter-spacing). It is safelisted and documented. Don't
  let the agent fall back to `text-2xl` for headings.
- **`web/.ds-css/` MUST stay gitignored.** Tailwind v4's automatic source detection honours
  `.gitignore`; if the output dir is ever tracked, Tailwind scans its own previous
  `styles.compiled.css`, harvests junk class-like tokens out of it (font filenames, `oklch`
  strings) and the stylesheet grows ~11 KB of garbage per run. Symptom: CSS size changes on a
  no-op rebuild. Verify determinism by running `build-css.mjs` twice and comparing sizes.

## Environment

- `package-validate.mjs` / `package-capture.mjs` need `DS_CHROMIUM_PATH=/usr/bin/google-chrome`.
  Playwright's browser download was skipped (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright`
  inside `.ds-sync/`) — the system Chrome is used instead.
- **`(.d.ts parse check skipped — typescript not in node_modules)` is a false message.**
  `typescript` IS installed in `.ds-sync/`; `import('typescript')` resolves but exposes no
  named ESM exports, so `ts.createSourceFile` is `undefined`, the call throws, and validate's
  `catch` misreports it as "not installed". The `.d.ts` files were instead verified with
  `tsc --noEmit` directly (all six clean). Don't chase this line.
- Creating the Design project via the **API returned 403 `subscription required`**; creating it
  in the claude.ai/design **web UI worked**, then a fresh `/design-login` let the API adopt it.
  If a future sync must create a project, expect to do it in the UI first.

## dtsPropsFor

Props are typed through `@base-ui/react` namespaces (`ButtonPrimitive.Props`,
`SwitchPrimitive.Root.Props`, `TabsPrimitive.Root.Props`). ts-morph flattens these to
`[key: string]: unknown`, which would leave the design agent with no API contract at all.
All six therefore use hand-written `cfg.dtsPropsFor` bodies, checked against the real
`@base-ui/react` `.d.ts` files (`checked` / `defaultChecked` / `onCheckedChange`;
`value` / `defaultValue` / `onValueChange` / `orientation`).

## Known render warns

- None outstanding. `[GRID_OVERFLOW]` on `Tabs` was real (both stories wider than a grid
  cell) and is fixed by `cfg.overrides.Tabs = {"cardMode": "column"}`.

## If the feature components are ever synced

- **`lucide-react` must be added to `cfg.extraEntries`.** Five feature components
  (`AppSidebar`, `AppHeader`, …) import icons from it, and it is currently NOT in the bundle
  (`grep -c lucide ds-bundle/_ds_bundle.js` → 0). Without it icons render as empty boxes.
- Add the feature-component dirs to `@source` in `build-css.mjs` so their `cva()`/utility
  classes compile; the safelist covers only the agent's own layout glue.
- Never stub `next/navigation`, `next-auth`, or `next-themes` to make a preview render — the
  card would then show a component that does not exist in the app. Extract the presentational
  layer instead (see the tiering in the sync conversation / plan file).

## Re-sync risks

- **Font vendoring hits the network** (Google Fonts). Offline re-syncs will fail at step 1;
  the woff2 files are gitignored, not committed.
- **The safelist can rot.** If `web/src/app/globals.css` gains new semantic tokens (e.g. a new
  `--warning`), neither the safelist nor `conventions.md` learns about it automatically.
  Re-check both when tokens change.
- **`dtsPropsFor` is hand-written** and will drift if `@base-ui/react` changes its prop names.
  Re-verify against `web/node_modules/@base-ui/react/*/root/*.d.ts` on a major bump.
- `web/.ds-entry.tsx` must be kept in step with `web/src/components/ui/` — a new primitive
  needs a line there **and** an entry in `componentSrcMap`.
- Dark mode was verified by rendering with `.dark` on `<html>` and confirming tokens flip
  (`--background` `oklch(0.985 …)` → `oklch(0.2 …)`), not by the render check, which only
  covers light.
