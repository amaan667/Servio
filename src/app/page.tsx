import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Servio - QR Code Ordering Made Simple
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Streamline your business operations with contactless QR code ordering.
            Manage menus, track orders, and enhance customer experience.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/dashboard" 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
            <Link 
              href="/sign-in" 
              className="bg-white hover:bg-gray-50 text-blue-600 font-semibold py-3 px-8 rounded-lg border border-blue-600 transition-colors"
            >
              Sign In
            </Link>
          </div>
          
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">QR Code Menus</h3>
              <p className="text-gray-600">
                Create digital menus with QR codes for contactless ordering
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Live Order Tracking</h3>
              <p className="text-gray-600">
                Monitor orders in real-time and manage your business efficiently
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Analytics & Insights</h3>
              <p className="text-gray-600">
                Get detailed analytics to optimize your operations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
