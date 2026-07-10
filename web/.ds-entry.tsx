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
