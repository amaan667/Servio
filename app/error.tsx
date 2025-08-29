'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to help with debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Application Error
          </h1>
          <p className="text-gray-600 mb-6">
            A client-side exception has occurred while loading the application.
          </p>
          
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <h2 className="text-sm font-medium text-red-800 mb-2">Error Details:</h2>
            <p className="text-sm text-red-700 mb-2">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-red-600">Error ID: {error.digest}</p>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Reload Page
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <p>If this error persists, please check:</p>
            <ul className="mt-2 space-y-1 text-left">
              <li>• Environment variables are properly configured</li>
              <li>• Supabase connection is working</li>
              <li>• Browser console for additional details</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
