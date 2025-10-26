import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for OrderCard component
 * Matches exact dimensions to prevent layout shift
 */
export function OrderCardSkeleton() {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {/* Order ID and Time */}
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Entity Badge and Status */}
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-14" />
            </div>
          </div>

          {/* Total Amount */}
          <Skeleton className="h-10 w-20" />
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Items Preview */}
        <div className="mb-4">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Multiple order card skeletons
 */
export function OrderCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}
