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
>(
  (
    {
      checked,
      onCheckedChange,
      disabled = false,
      className,
      showLabels = false,
      onLabel = "On",
      offLabel = "Off",
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <SwitchPrimitives.Root
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={cn(
            // Servio purple themed toggle switch
            "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-servio-purple focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation shadow-sm",
            "data-[state=checked]:bg-servio-purple data-[state=unchecked]:bg-gray-300"
          )}
          {...props}
          ref={ref}
        >
          <SwitchPrimitives.Thumb
            className={cn(
              // White thumb with smooth animation
              "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out",
              "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5"
            )}
          />
        </SwitchPrimitives.Root>
        {showLabels && (
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              checked ? "text-servio-purple" : "text-gray-500"
            )}
          >
            {checked ? onLabel : offLabel}
          </span>
        )}
      </div>
    );
  }
);

ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch };
