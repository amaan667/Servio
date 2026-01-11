/**
 * Loading State Component
 *
 * Best Practices:
 * - Use for full-page or component-level loading
 * - Prefer Skeleton components when you know the content structure
 * - Use for async data loading with Suspense boundaries
 *
 * Performance: Optimized with proper accessibility
 */

import { LoadingSpinner } from "./loading-spinner";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fullScreen?: boolean;
  variant?: "spinner" | "skeleton";
  skeletonCount?: number;
  className?: string;
}

/**
 * Loading State Component
 *
 * @example
 * // Full page loading
 * <LoadingState fullScreen message="Loading dashboard..." />
 *
 * // Component loading
 * <LoadingState message="Loading orders..." />
 *
 * // Skeleton variant
 * <LoadingState variant="skeleton" skeletonCount={3} />
 */
export function LoadingState({
  message = "Loading...",
  size = "lg",
  fullScreen = false,
  variant = "spinner",
  skeletonCount = 3,
  className,
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={fullScreen ? "min-h-screen p-6" : "p-6"}>
        <div className="space-y-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const containerClass = fullScreen
    ? "min-h-screen flex items-center justify-center"
    : "flex items-center justify-center py-12";

  return (
    <div className={cn(containerClass, className)} role="status" aria-live="polite">
      <div className="text-center">
        <LoadingSpinner size={size} className="mx-auto mb-4" />
        {message && (
          <p className="text-sm text-gray-600 mt-2" aria-label={message}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
