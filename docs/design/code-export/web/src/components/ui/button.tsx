// web/src/components/ui/button.tsx
// shadcn Button + thêm variant "accent" (hành động thưởng/khởi động)
// và "success". Giữ nguyên API shadcn.
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-4 focus-visible:ring-ring/20 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_6px_16px_--theme(--color-primary/28%)] hover:brightness-105 active:scale-[.98]",
        accent:
          "bg-accent text-accent-foreground shadow-[0_6px_16px_--theme(--color-accent/28%)] hover:brightness-105 active:scale-[.98]",
        success:
          "bg-success text-success-foreground shadow-[0_6px_16px_--theme(--color-success/28%)] hover:brightness-105 active:scale-[.98]",
        destructive:
          "bg-destructive-bg text-destructive hover:brightness-[.98]",
        outline:
          "border border-border bg-card hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-[.97]",
        ghost: "hover:bg-muted text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-9 rounded-md px-3.5 text-xs",
        lg: "h-13 rounded-lg px-7 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className, variant, size, asChild = false, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
}

export { Button, buttonVariants }
