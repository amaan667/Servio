"use client";

import React from "react";
import Link from "next/link";
import { usePrefetch } from "@/hooks/usePrefetch";

interface PerformanceLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
  [key: string]: unknown;
}

/**
 * High-performance Link component with intelligent prefetching
 * Prefetches routes on hover for instant navigation
 */
export const PerformanceLink = React.memo(function PerformanceLink({
  href,
  children,
  className,
  prefetch = true,
  ...props
}: PerformanceLinkProps) {
  const { prefetchOnHover } = usePrefetch();

  const handleMouseEnter = prefetch ? prefetchOnHover(href) : undefined;

  return (
    <Link href={href} className={className} onMouseEnter={handleMouseEnter} {...props}>
      {children}
    </Link>
  );
});

export default PerformanceLink;
