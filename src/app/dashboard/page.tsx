export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Servio Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your venues and orders</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <p className="text-gray-600 mt-2">
              Access your most important features
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <p className="text-gray-600 mt-2">
              View your latest orders and updates
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
            <p className="text-gray-600 mt-2">
              Track your business performance
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
