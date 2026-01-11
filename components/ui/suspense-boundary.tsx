/**
 * Optimized Suspense Boundary Component
 *
 * Best Practices:
 * - Wrap async components with Suspense boundaries
 * - Use streaming for better perceived performance
 * - Provide meaningful fallbacks
 *
 * Performance: Enables React streaming and reduces perceived load time
 */

import { Suspense, ReactNode } from "react";
import { LoadingState } from "./loading-state";
import { LOADING_MESSAGES } from "@/lib/constants/loading-messages";

interface SuspenseBoundaryProps {

}

/**
 * Optimized Suspense Boundary
 *
 * Wraps async components with proper loading states
 * Enables React streaming for better performance
 *
 * @example
 * <SuspenseBoundary message={LOADING_MESSAGES.ORDERS}>
 *   <OrdersList />
 * </SuspenseBoundary>
 *
 * @example
 * <SuspenseBoundary variant="skeleton" skeletonCount={5}>
 *   <MenuItemsList />
 * </SuspenseBoundary>
 */
export function SuspenseBoundary({
  children,
  fallback,
  message = LOADING_MESSAGES.DEFAULT,
  variant = "spinner",
  skeletonCount = 3,
}: SuspenseBoundaryProps) {
  const defaultFallback =
    variant === "skeleton" ? (
      <LoadingState variant="skeleton" skeletonCount={skeletonCount} />
    ) : (
      <LoadingState message={message} />
    );

  return <Suspense fallback={fallback || defaultFallback}>{children}</Suspense>;
}
