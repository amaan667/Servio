'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface ConfigStatus {
  hasUrl: boolean;
  hasKey: boolean;
  isConfigured: boolean;
}

export function SupabaseConfigCheck() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    hasUrl: false,
    hasKey: false,
    isConfigured: false
  });

  useEffect(() => {
    const checkConfig = () => {
      const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
      const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      setConfigStatus({
        hasUrl,
        hasKey,
        isConfigured: hasUrl && hasKey
      });
    };

    checkConfig();
  }, []);

  if (configStatus.isConfigured) {
    return null; // Don't show anything if properly configured
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <AlertCircle className="h-6 w-6 text-yellow-500 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">
            Configuration Required
          </h2>
        </div>
        
        <div className="space-y-3 mb-6">
          <div className="flex items-center">
            {configStatus.hasUrl ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
            )}
            <span className="text-sm">
              Supabase URL: {configStatus.hasUrl ? 'Configured' : 'Missing'}
            </span>
          </div>
          
          <div className="flex items-center">
            {configStatus.hasKey ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
            )}
            <span className="text-sm">
              Supabase API Key: {configStatus.hasKey ? 'Configured' : 'Missing'}
            </span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
          <h3 className="font-medium text-blue-800 mb-2">Setup Instructions:</h3>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Create a <code className="bg-blue-100 px-1 rounded">.env.local</code> file in the project root</li>
            <li>2. Add your Supabase configuration:</li>
          </ol>
          <pre className="mt-2 text-xs bg-blue-100 p-2 rounded overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here`}
          </pre>
          <p className="text-sm text-blue-700 mt-2">
            3. Restart the development server
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => window.location.reload()}
            className="bg-servio-purple text-white px-4 py-2 rounded-md hover:bg-servio-purple/90 text-sm"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}