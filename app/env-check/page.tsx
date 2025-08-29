'use client';

import { useEffect, useState } from 'react';

export default function EnvCheckPage() {
  const [envInfo, setEnvInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const response = await fetch('/api/env-check');
        const data = await response.json();
        setEnvInfo(data);
      } catch (error) {
        console.error('Failed to check environment:', error);
        setEnvInfo({ error: 'Failed to check environment' });
      } finally {
        setLoading(false);
      }
    };

    checkEnvironment();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking environment configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Environment Configuration Check</h1>
        
        {envInfo?.error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{envInfo.error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Environment Variables</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">NODE_ENV:</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      envInfo?.NODE_ENV ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {envInfo?.NODE_ENV || 'NOT SET'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">NEXT_PUBLIC_SITE_URL:</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      envInfo?.NEXT_PUBLIC_SITE_URL ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {envInfo?.NEXT_PUBLIC_SITE_URL || 'NOT SET'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">NEXT_PUBLIC_SUPABASE_URL:</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      envInfo?.NEXT_PUBLIC_SUPABASE_URL ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {envInfo?.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      envInfo?.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {envInfo?.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Browser Information</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">User Agent:</span>
                  <span className="text-gray-600">{navigator.userAgent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Platform:</span>
                  <span className="text-gray-600">{navigator.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Language:</span>
                  <span className="text-gray-600">{navigator.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Screen Size:</span>
                  <span className="text-gray-600">{window.screen.width}x{window.screen.height}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Window Size:</span>
                  <span className="text-gray-600">{window.innerWidth}x{window.innerHeight}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Troubleshooting</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p>If you're seeing configuration issues:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Check that all required environment variables are set in your Railway project</li>
                  <li>Verify that your Supabase project is properly configured</li>
                  <li>Ensure the NEXT_PUBLIC_SITE_URL matches your Railway deployment URL</li>
                  <li>Check the browser console for additional error details</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
