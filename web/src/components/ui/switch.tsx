"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted-foreground/30 p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
