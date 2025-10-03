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
  showLabels = true,
  onLabel = "On",
  offLabel = "Off",
  ...props 
}, ref) => {
  // Unified ToggleSwitch styling with Switch
  // Dimensions match `Switch`: h-5 w-9, thumb h-4 w-4, translate-x-4
  // Colors use theme primary when checked
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SwitchPrimitives.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-700"
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
          )}
        />
      </SwitchPrimitives.Root>
      {showLabels && (
        <span className={cn(
          "text-xs font-medium transition-colors",
          checked ? "text-primary" : "text-muted-foreground"
        )}>
          {checked ? onLabel : offLabel}
        </span>
      )}
    </div>
  );
});

ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch };
