// Design-system bundle entry. Not used by the app.
//
// This repo ships a Next.js app, not a library, so there is no dist/ entry for
// the converter to bundle. This barrel is an entry point OVER the real sources
// in src/components/ui — it re-exports them unchanged and reimplements nothing.
//
// Compound parts (CardHeader, TabsTrigger, …) are exported so previews and
// generated designs can compose the primitives; only the six top-level names
// are registered as components, via componentSrcMap in .design-sync/config.json.

export { Button, buttonVariants } from "@/components/ui/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export { Input } from "@/components/ui/input";
export { Skeleton } from "@/components/ui/skeleton";
export { Switch } from "@/components/ui/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from "@/components/ui/tabs";

// Feature components that are purely presentational: they depend only on `cn`
// and pure helpers (@/lib/toc, transcript, grading/error-span). Nothing here
// touches next/link, next/navigation, next-auth, next-themes, or Prisma, so
// they bundle as-is with no stubs.
export { AnswerKeyAccordion } from "@/components/AnswerKeyAccordion";
export { GoalPicker } from "@/components/GoalPicker";
export { ExplanationSlot } from "@/components/runner/ExplanationSlot";
export { AudioPlayer } from "@/components/AudioPlayer";
export { LectureToc } from "@/components/LectureToc";
export { MarkdownContent } from "@/components/MarkdownContent";
export { QuestionCard } from "@/components/runner/QuestionCard";
export { ListeningRunner } from "@/components/ListeningRunner";
export { ListeningSetView } from "@/components/ListeningSetView";

// App shell. Presentational after the linkComponent/logoutSlot/pathname
// extraction — no next/link, no next/navigation, no next-auth. The router-aware
// wrapper (AppSidebarConnected) deliberately stays in the app.
export { AppHeader } from "@/components/AppHeader";
export { AppSidebar } from "@/components/AppSidebar";

// Presentational after the Task 2–4 extraction: EmptyState/ListeningSetCard take
// an injected `linkComponent` (no next/link); LevelBadge reuses LEVEL_META whose
// `import type { CefrLevel }` is type-only and erased (no Prisma); PlacementWizard
// is a pure multi-step wizard (its two fetch() calls fire only on click).
export { EmptyState } from "@/components/EmptyState";
export { LevelBadge } from "@/components/LevelBadge";
export { ListeningSetCard } from "@/components/ListeningSetCard";
export { PlacementWizard } from "@/components/PlacementWizard";
