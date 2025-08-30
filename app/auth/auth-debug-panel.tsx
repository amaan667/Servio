'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthDebugPanel() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  const type = searchParams?.get('type');
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Add debug script
    const script = document.createElement('script');
    script.textContent = `
      (function() {
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
          
          // Create debug info
          const debugInfo = {
            hasVerifier,
            verifierLength: hasVerifier ? verifier.length : 0,
            localStorageKeys,
            sessionStorageKeys,
            timestamp: new Date().toISOString(),
            url: window.location.href
          };
          
          // Send to console
          console.log('[AUTH][CLIENT DEBUG] PKCE state:', debugInfo);
        } catch (error) {
          console.error('[AUTH][CLIENT DEBUG] Error in PKCE debug script:', error);
        }
      })();
    `;
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, []);
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4 w-full max-w-md">
      <h2 className="text-lg font-medium mb-2">Auth Debug Panel</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <h3 className="text-red-800 font-medium">Error Detected</h3>
          <p className="text-red-700 text-sm mt-1">{error}</p>
          {type && <p className="text-red-600 text-xs mt-1">Type: {type}</p>}
        </div>
      )}
      
      <div className="text-sm space-y-2">
        <p><strong>User Agent:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}</p>
        <p><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'Unknown'}</p>
        <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
      </div>
      
      <div className="mt-4 flex gap-2">
        <button 
          onClick={() => window.location.href = '/sign-in'}
          className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm"
        >
          Go to Sign In
        </button>
        <button 
          onClick={() => window.location.href = '/debug-auth'}
          className="bg-purple-500 text-white px-3 py-1 rounded-md text-sm"
        >
          Full Auth Debug
        </button>
      </div>
    </div>
  );
}
