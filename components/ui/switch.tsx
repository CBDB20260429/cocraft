"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import { ComponentPropsWithoutRef, ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitives.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border)] bg-[#ece7db] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,122,109,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffef9] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[#5d6793] data-[state=checked]:bg-[#5d6793]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block size-[18px] translate-x-0.5 rounded-full bg-[#fffef9] shadow-[0_1px_3px_rgba(48,40,28,0.22)] transition-transform data-[state=checked]:translate-x-[21px]"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
