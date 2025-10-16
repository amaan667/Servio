import { Skeleton } from "@/components/ui/skeleton";

export default function DemoLoading() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Menu items */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex gap-4">
                <Skeleton className="h-20 w-20 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cart */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

