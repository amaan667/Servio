"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface SkeletonProps {
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
        {/* Breadcrumb Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Header Skeleton */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Stats Overview Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="mb-6 sm:mb-8">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 text-center">
                  <Skeleton className="w-8 h-8 mx-auto mb-2 rounded-lg" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity Skeleton */}
        <div className="mb-6 sm:mb-8">
          <Skeleton className="h-5 w-40 mb-4" />
          <Card className="animate-pulse">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export const StatsCardSkeleton: React.FC = () => (
  <Card className="animate-pulse">
    <CardContent className="p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-12" />
        </div>
        <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="animate-pulse">
    <div className="overflow-hidden border rounded-lg">
      {/* Header */}
      <div
        className="grid gap-4 p-4 border-b bg-gray-50"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 p-4 border-b"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => (
  <div className="animate-pulse space-y-3">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);
