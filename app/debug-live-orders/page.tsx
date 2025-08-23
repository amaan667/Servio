export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerSupabase } from '@/lib/supabase-server';

export default async function DebugLiveOrdersPage() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
        length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***HIDDEN***' : 'MISSING',
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        value: process.env.SUPABASE_SERVICE_ROLE_KEY ? '***HIDDEN***' : 'MISSING',
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
      }
    },
    tests: {
      supabaseServer: null as any,
      supabaseConnection: null as any
    }
  };

  // Test Supabase server creation
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createServerSupabase();
      diagnostics.tests.supabaseServer = { success: true, message: 'Server client created successfully' };
      
      // Test connection
      try {
        const { data, error } = await supabase.from('venues').select('count').limit(1);
        if (error) {
          diagnostics.tests.supabaseConnection = { success: false, error: error.message };
        } else {
          diagnostics.tests.supabaseConnection = { success: true, message: 'Connection test successful' };
        }
      } catch (connError: any) {
        diagnostics.tests.supabaseConnection = { success: false, error: connError.message };
      }
    } else {
      diagnostics.tests.supabaseServer = { success: false, error: 'Missing environment variables' };
    }
  } catch (error: any) {
    diagnostics.tests.supabaseServer = { success: false, error: error.message };
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-8">Live Orders Debug Diagnostic</h1>
        
        <div className="space-y-6">
          {/* Environment Variables */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Environment Variables</h2>
            <div className="space-y-3">
              {Object.entries(diagnostics.environment).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="font-mono text-sm">{key}</span>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${value.exists ? 'text-green-600' : 'text-red-600'}`}>
                      {value.exists ? '✓ Set' : '✗ Missing'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Length: {value.length}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tests */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Connection Tests</h2>
            <div className="space-y-3">
              {Object.entries(diagnostics.tests).map(([testName, result]) => (
                <div key={testName} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="font-medium capitalize">{testName.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <div className="text-right">
                    {result ? (
                      <div className={`text-sm font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                        {result.success ? '✓ Success' : '✗ Failed'}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Not tested</div>
                    )}
                    {result?.error && (
                      <div className="text-xs text-red-500 mt-1">{result.error}</div>
                    )}
                    {result?.message && (
                      <div className="text-xs text-green-600 mt-1">{result.message}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recommendations</h2>
            <div className="space-y-3">
              {!diagnostics.environment.NEXT_PUBLIC_SUPABASE_URL.exists && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <h3 className="font-medium text-red-800">Missing NEXT_PUBLIC_SUPABASE_URL</h3>
                  <p className="text-red-700 text-sm mt-1">
                    Set this environment variable to your Supabase project URL.
                  </p>
                </div>
              )}
              
              {!diagnostics.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY.exists && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <h3 className="font-medium text-red-800">Missing NEXT_PUBLIC_SUPABASE_ANON_KEY</h3>
                  <p className="text-red-700 text-sm mt-1">
                    Set this environment variable to your Supabase anonymous key.
                  </p>
                </div>
              )}
              
              {diagnostics.environment.NEXT_PUBLIC_SUPABASE_URL.exists && 
               diagnostics.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY.exists && 
               !diagnostics.tests.supabaseConnection?.success && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <h3 className="font-medium text-yellow-800">Connection Issue</h3>
                  <p className="text-yellow-700 text-sm mt-1">
                    Environment variables are set but connection failed. Check your Supabase project status.
                  </p>
                </div>
              )}
              
              {diagnostics.tests.supabaseConnection?.success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <h3 className="font-medium text-green-800">All Systems Operational</h3>
                  <p className="text-green-700 text-sm mt-1">
                    Supabase connection is working correctly. The issue may be elsewhere.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-center text-sm text-gray-500">
            Diagnostic run at: {diagnostics.timestamp}
          </div>
        </div>
      </div>
    </div>
  );
}