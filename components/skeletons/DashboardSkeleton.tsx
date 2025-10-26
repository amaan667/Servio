import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for EnhancedStatCard
 */
export function StatCardSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Title */}
            <Skeleton className="h-4 w-24 mb-3" />

            {/* Value */}
            <Skeleton className="h-8 w-16 mb-2" />

            {/* Subtitle/Trend */}
            <Skeleton className="h-3 w-20" />
          </div>

          {/* Icon */}
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Grid of stat card skeletons
 */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Full dashboard skeleton
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats Grid */}
      <DashboardStatsSkeleton />

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
