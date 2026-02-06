"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface OrderCardSkeletonProps {
  count?: number;
}

export function OrderCardSkeleton({ count = 1 }: OrderCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="border border-slate-200">
          <CardContent className="p-4">
            {/* Header: Order ID and time */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-7 w-16" />
            </div>

            {/* Items preview */}
            <div className="space-y-2 mb-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

interface OrderCardSkeletonGridProps {
  count?: number;
  columns?: 1 | 2 | 3;
}

export function OrderCardSkeletonGrid({ count = 3, columns = 1 }: OrderCardSkeletonGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      <OrderCardSkeleton count={count} />
    </div>
  );
}
