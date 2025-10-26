import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for Table Card in Table Management
 * Matches exact dimensions to prevent layout shift
 */
export function TableCardSkeleton() {
  return (
    <Card className="border-2 border-gray-200">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-20" />
        </div>

        {/* Details */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Grid of table card skeletons
 */
export function TableCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <TableCardSkeleton key={i} />
      ))}
    </div>
  );
}
