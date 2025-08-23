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
      {/* Breadcrumbs */}
      {showBreadcrumbs && <UniversalBreadcrumbs />}
      
      {/* Header with title, description, and navigation */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {title}
            </h1>
            {showBackForward && (
              <BackForwardNav venueId={venueId} />
            )}
          </div>
          {description && (
            <p className="text-sm sm:text-lg text-muted-foreground">
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