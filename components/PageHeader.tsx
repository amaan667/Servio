"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import UniversalBreadcrumbs from "./UniversalBreadcrumbs";
import BackForwardNav from "./BackForwardNav";

interface PageHeaderProps {
  title: string;
  description?: string;
  venueId?: string;
  children?: ReactNode;
  className?: string;
  showBackForward?: boolean;
  showBreadcrumbs?: boolean;
}

export default function PageHeader({
  title,
  description,
  venueId,
  children,
  className,
  showBackForward = true,
  showBreadcrumbs = true,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      {/* Top row with back button on the right */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1" />
        {showBackForward && (
          <BackForwardNav venueId={venueId} />
        )}
      </div>
      
      {/* Breadcrumbs */}
      {showBreadcrumbs && <UniversalBreadcrumbs />}
      
      {/* Header with title and description */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          {description && (
            <p className="text-sm sm:text-lg text-muted-foreground mt-2">
              {description}
            </p>
          )}
        </div>
        
        {/* Optional right-side content */}
        {children && (
          <div className="flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}