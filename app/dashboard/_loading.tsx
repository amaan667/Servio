export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h2>
        <p className="text-gray-600">Setting up your venue dashboard...</p>
      </div>
    </div>
  );
}
