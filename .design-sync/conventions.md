# Học tiếng Anh — design system conventions

Compiled from the app's real sources. React 19. Everything is exported on
`window.HocTiengAnhDS`.

- **Primitives** (`src/components/ui`): `Button`, `Card`, `Input`, `Skeleton`, `Switch`, `Tabs`.
- **Feature components** — prefer these over rebuilding them from primitives:
  `MarkdownContent` (lesson/lecture prose), `AudioPlayer` (`compact` | `full`),
  `LectureToc` (sticky rail; needs a ≥1024px column — it is `hidden lg:block`),
  `GoalPicker` (IELTS band / CEFR level / TOEIC score, fully controlled),
  `AnswerKeyAccordion` (closed-by-default answer key on the amber `streak` surface),
  `QuestionCard` + `ExplanationSlot` (a single exercise question and its explanation),
  `ListeningRunner` and `ListeningSetView` (whole listening screens).

## Setup

**No provider is required.** Components read no React context — import and render
them directly. Two things do matter:

- **Dark mode is a CSS class, not a context.** Put `class="dark"` on `<html>` (or any
  ancestor); the variant is `&:is(.dark *)`. There is no `ThemeProvider` in this
  bundle — the app uses `next-themes`, which is app-side only and not shipped here.
- **`Card` and `Tabs` are compound.** Use the parts, not `className` surgery:
  `Card` → `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`,
  `CardFooter`. `Tabs` → `TabsList`, `TabsTrigger`, `TabsContent` (match `TabsTrigger
  value` to `TabsContent value`; set `defaultValue` on `Tabs`).

## Styling idiom: Tailwind v4 utilities over semantic tokens

Never hard-code a hex or an `oklch()`. Style through the semantic scale so light and
dark both work for free:

| Purpose | Classes |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary` |
| Text | `text-foreground`, `text-card-foreground`, `text-muted-foreground` |
| Brand (indigo-violet) | `bg-primary`, `text-primary`, `text-primary-foreground` |
| Accent (coral) | `bg-accent`, `text-accent-foreground` |
| Positive | `bg-success`, `text-success-foreground` |
| Negative | `text-destructive`, `bg-destructive` |
| Lines | `border`, `border-border`, `border-input`, `ring-1` |
| Headings | `font-heading` |

**Prefer this DS's own type scale over the generic `text-{sm,lg,2xl}` sizes**, because it
carries the tuned line-height and letter-spacing: `text-h1` (1.875rem, tight),
`text-h2` (1.375rem), `text-body` (1rem / 1.6), `text-caption` (0.8125rem). It is
responsive-friendly — `lg:text-h2` works.

The underlying tokens are CSS custom properties — `--primary`, `--accent`, `--success`,
`--destructive`, `--muted`, `--border`, `--ring`, `--radius`, plus the app's own
`--success-bg`, `--destructive-bg`, `--streak`, `--streak-bg`.

Three semantic pairs carry state and have real utility classes — use them rather than
inventing colours: **correct/positive** `bg-success-bg` + `border-success` + `text-success`;
**wrong/destructive** `bg-destructive-bg` + `border-destructive` + `text-destructive`;
**streak/warning** `bg-streak-bg` + `border-streak` + `text-streak-foreground` (the amber
gamification surface, e.g. the answer-key accordion).

**Critical constraint — the stylesheet is static.** Designs receive a pre-compiled
`styles.css`; there is no Tailwind JIT at design time. Only these utility families
resolve, so stay inside them:

`flex` `inline-flex` `grid` `block` `hidden` `relative` `absolute` `truncate`
`overflow-hidden` · `flex-{row,col,wrap}` · `items-{start,center,end,baseline}` ·
`justify-{start,center,end,between,around}` · `grid-cols-{1..4}` ·
`gap{,-x,-y}-{0,1,1.5,2,3,4,5,6,8}` · `{p,px,py,pt,pb,pl,pr}-{0..10}` ·
`{m,mx,my,mt,mb}-{0,1,2,3,4,6,8,auto}` · `space-y-{1,1.5,2,3,4,6}` ·
`w-{full,fit,40,52,64,72,80,96}` · `h-{full,fit,4,6,8,9,10,11,12,24}` ·
`size-{4,5,6,8,10,12}` · `max-w-{xs,sm,md,lg,xl,2xl}` · `rounded{,-sm,-md,-lg,-xl,-2xl,-full}` ·
`text-{xs,sm,base,lg,xl,2xl,3xl}` · `font-{normal,medium,semibold,bold,heading}` ·
`leading-{none,snug,normal,relaxed}` · `text-{left,center,right}` ·
`shadow-{xs,sm,md,lg}` · `opacity-{50,60,70,80}` · `cursor-{pointer,not-allowed}`

An arbitrary utility (`gap-7`, `w-[321px]`, `bg-blue-500`) will produce **no CSS at all**.

## Copy convention

**UI copy is Vietnamese.** Buttons, labels, headings, empty states — all Vietnamese
("Bắt đầu học", "Nộp bài", "Từ vựng"). English appears only *inside lesson content*
(example sentences, vocabulary, IELTS passages). The brand font, Be Vietnam Pro, ships
with full Vietnamese diacritics.

## Where the truth lives

Read `styles.css` and its `@import` closure for the real token values, and
`components/<Group>/<Name>/<Name>.d.ts` for each component's exact prop contract
(`<Name>Props`). `<Name>.prompt.md` holds per-component usage notes.

## Idiomatic example

```jsx
<Card className="w-80">
  <CardHeader>
    <CardTitle>Bài 12 — Thì hiện tại hoàn thành</CardTitle>
    <CardDescription>Ngữ pháp · trình độ B1</CardDescription>
    <CardAction>
      <Button size="xs" variant="ghost">Lưu</Button>
    </CardAction>
  </CardHeader>
  <CardContent className="text-muted-foreground">
    Học cách dùng <em>present perfect</em> để nói về trải nghiệm.
  </CardContent>
  <CardFooter className="flex gap-2">
    <Button variant="default">Vào học</Button>
    <Button variant="outline">Xem đáp án</Button>
  </CardFooter>
</Card>
```

`Button` variants: `default` `accent` `success` `outline` `secondary` `ghost`
`destructive` `link`. Sizes: `default` `xs` `sm` `lg` `icon` `icon-xs` `icon-sm` `icon-lg`.
