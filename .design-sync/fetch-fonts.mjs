// Vendors the brand webfonts into web/.ds-css/fonts/ and writes fonts.css.
//
// The app loads fonts via next/font/google, which means NO font files exist in
// the repo. A design-system bundle has no Next.js runtime, so without this step
// every design built from the DS silently renders in a fallback font.
//
// Run before build-css.mjs. Output is gitignored; re-run on a fresh clone.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('../web/.ds-css/fonts/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// A modern UA is required or Google serves .ttf instead of .woff2.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const FAMILIES = [
  { css: 'Be+Vietnam+Pro:wght@400;500;600;700;800', subsets: ['latin', 'vietnamese', 'latin-ext'] },
  { css: 'Geist+Mono:wght@400', subsets: ['latin'] },
];

let out = '';
let n = 0;

for (const fam of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`;
  const css = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
    return r.text();
  });

  // Google emits one @font-face per (weight, subset), each preceded by a
  // `/* subset */` comment. Keep only the subsets the app declares.
  const blocks = css.split('/*').slice(1);
  for (const raw of blocks) {
    const subset = raw.slice(0, raw.indexOf('*/')).trim();
    if (!fam.subsets.includes(subset)) continue;
    const block = raw.slice(raw.indexOf('*/') + 2);
    const m = block.match(/@font-face\s*\{[^}]+\}/);
    if (!m) continue;

    const rule = m[0];
    const remote = rule.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (!remote) continue;
    const family = rule.match(/font-family:\s*'([^']+)'/)?.[1] ?? 'font';
    const weight = rule.match(/font-weight:\s*(\d+)/)?.[1] ?? '400';

    const name = `${family.replace(/\s+/g, '')}-${weight}-${subset}.woff2`;
    const buf = Buffer.from(await fetch(remote).then((r) => r.arrayBuffer()));
    writeFileSync(join(OUT, name), buf);
    n++;

    out += rule.replace(remote, `./fonts/${name}`) + '\n';
  }
}

// The @font-face rules live one level up so url(./fonts/…) resolves, matching
// what lib/css.mjs extractFonts() expects (urls relative to the cssEntry file).
writeFileSync(new URL('../web/.ds-css/fonts.css', import.meta.url).pathname, out);
console.error(`fonts: ${n} woff2 vendored -> web/.ds-css/fonts/`);
