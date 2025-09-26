export default function VenueDashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center space-x-2 mb-6">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-2 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-96 bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border p-6">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        
        {/* Quick actions skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border p-6">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-6">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
