'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthDebugPanel from '../auth-debug-panel';

export default function CallbackDebugPage() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Check if PKCE verifier exists in localStorage
      const verifier = localStorage.getItem('supabase.auth.token-code-verifier');
      const hasVerifier = !!verifier;
      
      // Log all auth-related localStorage and sessionStorage items
      const localStorageKeys = Object.keys(localStorage).filter(k => 
        k.includes('auth') || k.includes('supabase') || k.includes('sb-') || k.includes('token') || k.includes('code')
      );
      
      const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
        k.includes('auth') || k.includes('supabase') || k.includes('sb-') || k.includes('token') || k.includes('code')
      );
      
      // Convert search params to object safely
      const params = searchParams ? Object.fromEntries([...searchParams.entries()]) : {};
      
      // Log PKCE state
      console.log('[AUTH][CLIENT DEBUG] PKCE state on callback debug page:', {
        hasVerifier,
        verifierLength: hasVerifier ? verifier.length : 0,
        localStorageKeys,
        sessionStorageKeys,
        searchParams: params,
        timestamp: new Date().toISOString()
      });
      
      // Also send to server for logging
      fetch('/api/auth/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hasVerifier,
          verifierLength: hasVerifier ? verifier.length : 0,
          localStorageKeys,
          sessionStorageKeys,
          searchParams: params,
          timestamp: new Date().toISOString(),
          context: 'callback-debug page'
        })
      }).catch(() => {});
    } catch (error) {
      console.error('[AUTH][CLIENT DEBUG] Error in PKCE debug hook:', error);
    }
  }, [searchParams]);
  
  // Convert search params to object safely
  const params = searchParams ? Object.fromEntries([...searchParams.entries()]) : {};
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Auth Callback Debug</h1>
      
      <AuthDebugPanel />
      
      <div className="w-full max-w-md mt-4">
        <h2 className="text-lg font-medium mb-2">URL Parameters</h2>
        <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-auto">
          {JSON.stringify(params, null, 2)}
        </pre>
      </div>
    </div>
  );
}
