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
    
    // Verify if the PKCE cookie check is present
    if (document.cookie.includes('_check_pkce=true')) {
      // Write the PKCE verifier to a cookie for server-side visibility
      if (hasVerifier) {
        document.cookie = '_pkce_verifier_exists=true; path=/; max-age=60';
        document.cookie = `_pkce_verifier_length=${verifier.length}; path=/; max-age=60`;
      } else {
        document.cookie = '_pkce_verifier_exists=false; path=/; max-age=60';
      }
    }
  } catch (error) {
    console.error('[AUTH][CLIENT DEBUG] Error in PKCE debug script:', error);
  }
})();
