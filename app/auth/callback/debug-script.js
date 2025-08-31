// Script to help debug PKCE verifier issues
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
    
    // Also log this info via a fetch request for server-side visibility
    fetch('/api/auth/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(debugInfo)
    }).catch(() => {});
    
    // Note: Cookie manipulation removed to prevent Next.js App Router errors
    // Debug information is now only sent via fetch request to server
  } catch (error) {
    console.error('[AUTH][CLIENT DEBUG] Error in PKCE debug script:', error);
  }
})();
