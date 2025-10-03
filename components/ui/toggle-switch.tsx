"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
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
  HTMLButtonElement,
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
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
      />
      {showLabels && (
        <span className={cn(
          "text-sm font-medium transition-colors",
          checked ? "text-green-600" : "text-gray-500"
        )}>
          {checked ? onLabel : offLabel}
        </span>
      )}
    </div>
  );
});

ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch };
