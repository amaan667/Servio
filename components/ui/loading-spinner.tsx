/**
 * Unified Loading Spinner Component
 *
 * Best Practices:
 * - Use for inline/button loading states
 * - Prefer Skeleton components for content placeholders
 * - Use LoadingState for full-page/component loading
 *
 * Performance: Optimized with minimal re-renders
 */

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LoadingSpinnerSize = "sm" | "md" | "lg" | "xl";
export type LoadingSpinnerColor = "purple" | "gray" | "white" | "green";

interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  color?: LoadingSpinnerColor;
  className?: string;
  "aria-label"?: string;
}

const sizeMap: Record<LoadingSpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const colorMap: Record<LoadingSpinnerColor, string> = {
  purple: "text-purple-600",
  gray: "text-gray-600",
  white: "text-white",
  green: "text-green-600",
};

/**
 * Unified Loading Spinner
 *
 * @example
 * // Inline loading
 * <LoadingSpinner size="sm" />
 *
 * // Button loading
 * <Button disabled={isLoading}>
 *   {isLoading && <LoadingSpinner size="sm" color="white" className="mr-2" />}
 *   Save
 * </Button>
 *
 * // Full page loading
 * <LoadingState size="lg" message="Loading dashboard..." />
 */
export function LoadingSpinner({
  size = "md",
  color = "purple",
  className,
  "aria-label": ariaLabel = "Loading",
}: LoadingSpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin", sizeMap[size], colorMap[color], className)}
      aria-label={ariaLabel}
      role="status"
      aria-live="polite"
    />
  );
}
