'use client';

import { useEffect, useState } from 'react';

export default function TestEnvPage() {
  const [envInfo, setEnvInfo] = useState<any>(null);

  useEffect(() => {
    setEnvInfo({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      NODE_ENV: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Test</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(envInfo, null, 2)}
      </pre>
    </div>
  );
}
