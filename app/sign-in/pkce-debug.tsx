'use client';

import { useEffect, useState } from 'react';

export default function PkceDebugComponent() {
  const [pkceState, setPkceState] = useState<any>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    function checkPkceState() {
      try {
        const verifier = localStorage.getItem('supabase.auth.token-code-verifier');
        const hasVerifier = !!verifier;
        
        // Get all localStorage keys
        const localStorageKeys = Object.keys(localStorage).filter(k => 
          k.includes('auth') || k.includes('supabase') || k.includes('sb-') || k.includes('token') || k.includes('code')
        );
        
        // Get all sessionStorage keys
        const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
          k.includes('auth') || k.includes('supabase') || k.includes('sb-') || k.includes('token') || k.includes('code')
        );
        
        setPkceState({
          hasVerifier,
          verifierLength: hasVerifier ? verifier.length : 0,
          localStorageKeys,
          sessionStorageKeys,
          timestamp: new Date().toISOString()
        });
        
        // Log to console
        console.log('[AUTH][DEBUG] PKCE state on sign-in page:', {
          hasVerifier,
          verifierLength: hasVerifier ? verifier.length : 0,
          localStorageKeys,
          sessionStorageKeys
        });
      } catch (error) {
        console.error('[AUTH][DEBUG] Error checking PKCE state:', error);
        setPkceState({ error: String(error) });
      }
    }
    
    // Check immediately and then every 2 seconds
    checkPkceState();
    const interval = setInterval(checkPkceState, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (!pkceState) return null;
  
  return (
    <div className="bg-gray-100 p-4 rounded-md mt-4 text-left text-sm">
      <h3 className="font-medium mb-2">PKCE Verifier Status</h3>
      <div className="space-y-1">
        <p>
          Verifier: {pkceState.hasVerifier ? (
            <span className="text-green-600 font-medium">Present</span>
          ) : (
            <span className="text-red-600 font-medium">Missing</span>
          )}
        </p>
        {pkceState.hasVerifier && (
          <p>Length: {pkceState.verifierLength} characters</p>
        )}
        <p>Last Updated: {new Date(pkceState.timestamp).toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
