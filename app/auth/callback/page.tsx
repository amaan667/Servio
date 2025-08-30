'use client';

import { useEffect } from 'react';
import CallbackDebug from './debug';

export default function CallbackPage() {
  useEffect(() => {
    // Add script to help with debugging
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
          console.log('[AUTH][CLIENT DEBUG] PKCE state from inline script:', debugInfo);
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
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <h1 className="text-xl font-medium">Authenticating...</h1>
          <p className="text-gray-500">Please wait while we securely sign you in.</p>
        </div>
      </div>
      <CallbackDebug />
    </div>
  );
}
