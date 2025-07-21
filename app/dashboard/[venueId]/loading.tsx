export default function VenueDashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-servio-purple mx-auto mb-4"></div>
        <p className="text-gray-600">Loading venue dashboard...</p>
      </div>
    </div>
  );
}
