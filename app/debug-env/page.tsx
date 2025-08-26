"use client";

import { useEffect, useState } from 'react';

export default function DebugEnvPage() {
  const [envVars, setEnvVars] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkEnvVars = async () => {
      try {
        // Check client-side environment variables
        const clientEnvVars = {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
          NODE_ENV: process.env.NODE_ENV,
        };

        // Check server-side environment variables via API
        const response = await fetch('/api/env-debug');
        const serverEnvVars = await response.json();

        setEnvVars({
          client: clientEnvVars,
          server: serverEnvVars,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkEnvVars();
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Environment Variables Debug</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-3">Client-Side (Browser)</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(envVars?.client, null, 2)}
          </pre>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-3">Server-Side (API)</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(envVars?.server, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Analysis</h2>
        <ul className="space-y-2">
          <li>
            <strong>Supabase URL:</strong> 
            {envVars?.client?.NEXT_PUBLIC_SUPABASE_URL ? '✅ Available' : '❌ Missing'}
          </li>
          <li>
            <strong>Supabase Anon Key:</strong> 
            {envVars?.client?.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'SET' ? '✅ Available' : '❌ Missing'}
          </li>
          <li>
            <strong>Environment:</strong> {envVars?.client?.NODE_ENV}
          </li>
        </ul>
      </div>
    </div>
  );
}