// Compiles the app's Tailwind v4 stylesheet into one static CSS file for
// cfg.cssEntry. The converter COPIES cssEntry verbatim — it never runs Tailwind
// — so an uncompiled globals.css would ship `@import "tailwindcss"` and every
// preview would render unstyled.
//
// Tailwind v4 only emits utilities it finds by scanning source, and this DS's
// classes live inside cva() strings in the component sources and in the
// authored preview .tsx files. Hence the explicit @source directives: miss one
// and the affected utilities vanish from the output.
//
// Order: fetch-fonts.mjs -> build-css.mjs -> package-build.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname;
const WEB = `${ROOT}web`;
const OUT_DIR = `${WEB}/.ds-css`;

// @source globs are resolved relative to the file holding them, so the entry
// must sit at a known depth. Previews may not exist yet on a first run.
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(`${ROOT}.design-sync/previews`, { recursive: true });

const entry = `@import "../src/app/globals.css";
@import "./fonts.css";

@source "../src/components/ui";
@source "../src/components";
@source "../../.design-sync/previews";

/* Designs rendered from this DS receive ONLY this compiled stylesheet — there
   is no Tailwind JIT at design time. Utilities the six components happen not to
   use would therefore resolve to nothing, and the design agent's own layout
   glue would silently fail. Safelist the layout/typography/semantic-color
   vocabulary the conventions header tells the agent it may use. Anything added
   here must also be documented there, and vice versa. */
@source inline("{flex,inline-flex,grid,block,inline-block,hidden,relative,absolute,truncate,overflow-hidden}");
@source inline("flex-{row,col,wrap}");
@source inline("items-{start,center,end,baseline}");
@source inline("justify-{start,center,end,between,around}");
@source inline("grid-cols-{1,2,3,4}");
@source inline("{gap,gap-x,gap-y}-{0,1,1.5,2,3,4,5,6,8}");
@source inline("{p,px,py,pt,pb,pl,pr}-{0,1,2,3,4,5,6,8,10}");
@source inline("{m,mx,my,mt,mb}-{0,1,2,3,4,6,8,auto}");
@source inline("space-y-{1,1.5,2,3,4,6}");
@source inline("w-{full,fit,40,52,64,72,80,96}");
@source inline("h-{full,fit,4,6,8,9,10,11,12,24}");
@source inline("size-{4,5,6,8,10,12}");
@source inline("max-w-{xs,sm,md,lg,xl,2xl}");
@source inline("min-w-0");
@source inline("rounded{,-sm,-md,-lg,-xl,-2xl,-full}");
@source inline("text-{xs,sm,base,lg,xl,2xl,3xl}");
/* the DS's own type scale, from @theme --text-* in globals.css */
@source inline("text-{h1,h2,h3,body,caption}");
@source inline("font-{normal,medium,semibold,bold,heading}");
@source inline("leading-{none,snug,normal,relaxed}");
@source inline("text-{left,center,right}");
@source inline("bg-{background,card,popover,muted,primary,secondary,accent,success,destructive,transparent}");
@source inline("text-{foreground,card-foreground,muted-foreground,primary,primary-foreground,secondary-foreground,accent-foreground,success-foreground,destructive}");
@source inline("border{,-0,-2,-t,-b,-border,-input}");
/* semantic state pairs the conventions header promises (the components use them
   only with opacity modifiers, so the bare classes need pinning) */
@source inline("{bg,border,text}-{success,destructive,streak}");
@source inline("bg-{success,destructive,streak}-bg");
@source inline("text-{success,destructive,streak}-foreground");
@source inline("ring-{1,2,3}");
@source inline("shadow-{xs,sm,md,lg}");
@source inline("opacity-{50,60,70,80}");
@source inline("cursor-{pointer,not-allowed}");

/* next/font normally injects these; the DS bundle has no Next runtime, so bind
   them to the self-hosted families vendored by fetch-fonts.mjs. @theme inline
   in globals.css reads --font-be-vietnam-pro for --font-sans. */
:root {
  --font-be-vietnam-pro: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;
  --font-geist-mono: "Geist Mono", ui-monospace, SFMono-Regular, monospace;
}
`;

const entryPath = `${OUT_DIR}/entry.css`;
writeFileSync(entryPath, entry);

const require = createRequire(`${WEB}/package.json`);
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

const result = await postcss([tailwind()]).process(readFileSync(entryPath, 'utf8'), {
  from: entryPath,
  to: `${OUT_DIR}/styles.compiled.css`,
});

writeFileSync(`${OUT_DIR}/styles.compiled.css`, result.css);
console.error(`css: ${(result.css.length / 1024).toFixed(1)} KB -> web/.ds-css/styles.compiled.css`);
