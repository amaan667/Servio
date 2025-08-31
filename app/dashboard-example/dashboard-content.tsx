'use client';

import { useAuthContext } from '@/components/auth-provider';

export function DashboardContent() {
  const { user, loading, error } = useAuthContext();

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium">Authentication Error</h3>
        <p className="text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-yellow-800 font-medium">Not Authenticated</h3>
        <p className="text-yellow-600 mt-2">Please sign in to view this content.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Welcome, {user.email}!
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium text-blue-900">User ID</h3>
          <p className="text-blue-700 text-sm mt-1">{user.id}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-medium text-green-900">Email</h3>
          <p className="text-green-700 text-sm mt-1">{user.email}</p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-medium text-purple-900">Last Sign In</h3>
          <p className="text-purple-700 text-sm mt-1">
            {user.last_sign_in_at 
              ? new Date(user.last_sign_in_at).toLocaleDateString()
              : 'Unknown'
            }
          </p>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">User Metadata</h3>
        <pre className="text-xs text-gray-600 overflow-auto">
          {JSON.stringify(user.user_metadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}