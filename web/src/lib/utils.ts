import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only recognises `text-*` as a font size when the value looks
 * like a t-shirt size (`text-sm`, `text-2xl`, …). Our design-system scale
 * (`text-h1`/`h2`/`body`/`caption`, defined in globals.css) does not, so it was
 * being classified as a *colour* — and any colour class in a later argument,
 * e.g. `cn("text-caption", "text-muted-foreground")`, silently deleted the size.
 * Registering the scale here keeps size and colour in separate conflict groups.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["h1", "h2", "body", "caption"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
