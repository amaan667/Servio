"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Modern, larger toggle switch with clear on/off states
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-servio-purple focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
      // ON state: Green background with white border
      "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-600 data-[state=checked]:shadow-[0_0_10px_rgba(34,197,94,0.4)]",
      // OFF state: Gray background with darker border
      "data-[state=unchecked]:bg-gray-400 data-[state=unchecked]:border-gray-500 data-[state=unchecked]:shadow-sm",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Larger white thumb with icon and smooth animation
        "pointer-events-none relative flex items-center justify-center h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    >
      {/* Icons for clear visual state */}
      {props.checked ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <X className="h-3 w-3 text-gray-600" />
      )}
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
