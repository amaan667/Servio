'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/authenticated-client-provider';

export default function SignInDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const { session, loading, authReady } = useAuth();

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        const response = await fetch('/api/debug-auth?action=test-session');
        const data = await response.json();
        setDebugInfo(data);
      } catch (error) {
        console.error('Failed to fetch debug info:', error);
      }
    };

    fetchDebugInfo();
  }, []);

  return (
    <div className="p-4 bg-gray-100 rounded-lg mt-4">
      <h3 className="font-bold mb-2">Debug Information</h3>
      <div className="text-sm space-y-1">
        <div>Auth Ready: {authReady ? 'Yes' : 'No'}</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
        <div>Has Session: {session ? 'Yes' : 'No'}</div>
        <div>User ID: {session?.user?.id || 'None'}</div>
        <div>User Email: {session?.user?.email || 'None'}</div>
        {debugInfo && (
          <div className="mt-2">
            <div>API Session: {debugInfo.session?.hasSession ? 'Yes' : 'No'}</div>
            <div>API User ID: {debugInfo.session?.userId || 'None'}</div>
            <div>Environment: {debugInfo.environment?.hasSupabaseUrl ? 'Configured' : 'Missing'}</div>
          </div>
        )}
      </div>
    </div>
  );
}