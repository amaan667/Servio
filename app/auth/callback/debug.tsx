'use client';

import { useEffect } from 'react';
import { usePKCEDebug } from '@/lib/hooks/use-pkce-debug';

export default function CallbackDebug() {
  // Use our PKCE debug hook
  usePKCEDebug();
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Add a small delay to let the exchange happen first
    const timer = setTimeout(() => {
      try {
        // Check localStorage for the PKCE verifier
        const verifier = localStorage.getItem('supabase.auth.token-code-verifier');
        
        // Check if we have an exchange error in the URL
        const url = new URL(window.location.href);
        const error = url.searchParams.get('error');
        
        console.log('[AUTH][CLIENT CALLBACK] Post-exchange state:', {
          hasVerifier: !!verifier,
          verifierLength: verifier?.length,
          hasError: !!error,
          error,
          pathname: window.location.pathname,
          search: window.location.search
        });
      } catch (error) {
        console.error('[AUTH][CLIENT CALLBACK] Error checking state:', error);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // This component doesn't render anything visible
  return null;
}
