'use client';

import { useEffect } from 'react';

export function usePKCEDebug() {
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
      
      // Log PKCE state
      console.log('[AUTH][CLIENT DEBUG] PKCE state on page load:', {
        hasVerifier,
        verifierLength: hasVerifier ? verifier.length : 0,
        localStorageKeys,
        sessionStorageKeys,
        pathname: window.location.pathname,
        search: window.location.search,
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
          pathname: window.location.pathname,
          search: window.location.search,
          timestamp: new Date().toISOString(),
          context: 'usePKCEDebug hook'
        })
      }).catch(() => {});
    } catch (error) {
      console.error('[AUTH][CLIENT DEBUG] Error in PKCE debug hook:', error);
    }
  }, []);
}
