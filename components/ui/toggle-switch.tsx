"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  showLabels?: boolean;
  onLabel?: string;
  offLabel?: string;
}

const ToggleSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  ToggleSwitchProps
>(({ 
  checked, 
  onCheckedChange, 
  disabled = false, 
  className,
  showLabels = false,
  onLabel = "On",
  offLabel = "Off",
  ...props 
}, ref) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SwitchPrimitives.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          // Clean minimal switch - no borders, simple colors
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation shadow-sm",
          "data-[state=checked]:bg-servio-purple data-[state=unchecked]:bg-gray-400"
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200",
            "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5"
          )}
        />
      </SwitchPrimitives.Root>
      {showLabels && (
        <span className={cn(
          "text-sm font-medium transition-colors",
          checked ? "text-servio-purple" : "text-gray-500"
        )}>
          {checked ? onLabel : offLabel}
        </span>
      )}
    </div>
  );
});

ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch };