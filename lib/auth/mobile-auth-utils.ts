// Mobile-specific authentication utilities for debugging and testing

// Enhanced mobile detection with detailed browser info
export function getMobileBrowserInfo() {
  if (typeof window === 'undefined') return { isMobile: false, type: 'unknown', details: {} };
  
  const userAgent = window.navigator.userAgent;
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent.toLowerCase());
  
  let browserType = 'unknown';
  let browserDetails = {};
  
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserType = 'safari';
    browserDetails = {
      isIOS: /iphone|ipad|ipod/i.test(userAgent),
      isIPhone: /iphone/i.test(userAgent),
      isIPad: /ipad/i.test(userAgent),
      version: userAgent.match(/Version\/(\d+)/)?.[1] || 'unknown'
    };
  } else if (userAgent.includes('Chrome')) {
    browserType = 'chrome';
    browserDetails = {
      isAndroid: /android/i.test(userAgent),
      version: userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'
    };
  } else if (userAgent.includes('Firefox')) {
    browserType = 'firefox';
    browserDetails = {
      version: userAgent.match(/Firefox\/(\d+)/)?.[1] || 'unknown'
    };
  } else if (userAgent.includes('Edge')) {
    browserType = 'edge';
    browserDetails = {
      version: userAgent.match(/Edge\/(\d+)/)?.[1] || 'unknown'
    };
  }
  
  return {
    isMobile,
    type: browserType,
    userAgent,
    details: browserDetails
  };
}

// Test storage functionality on mobile devices
export function testMobileStorage() {
  try {
    const testKey = 'mobile_storage_test_' + Date.now();
    const testValue = 'test_value_' + Math.random();
    const results = {
      localStorage: { working: false, error: null },
      sessionStorage: { working: false, error: null },
      cookies: { working: false, error: null }
    };
    
    // Test localStorage
    try {
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      results.localStorage.working = retrieved === testValue;
    } catch (error) {
      results.localStorage.error = error;
    }
    
    // Test sessionStorage
    try {
      sessionStorage.setItem(testKey, testValue);
      const retrieved = sessionStorage.getItem(testKey);
      sessionStorage.removeItem(testKey);
      results.sessionStorage.working = retrieved === testValue;
    } catch (error) {
      results.sessionStorage.error = error;
    }
    
    // Test cookies
    try {
      document.cookie = `${testKey}=${testValue}; path=/`;
      const hasCookie = document.cookie.includes(testKey);
      document.cookie = `${testKey}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      results.cookies.working = hasCookie;
    } catch (error) {
      results.cookies.error = error;
    }
    
    return results;
  } catch (error) {
    return { error: error };
  }
}

// Enhanced PKCE verifier checking for mobile
export function checkMobilePKCEState() {
  try {
    const browserInfo = getMobileBrowserInfo();
    const storageTest = testMobileStorage();
    
    // Check for PKCE verifiers in various storage locations
    const verifierChecks = {
      supabaseVerifier: localStorage.getItem("supabase.auth.token-code-verifier"),
      customVerifier: sessionStorage.getItem('pkce_verifier'),
      pkceKeys: Object.keys(localStorage).filter(k => 
        k.includes("pkce") || k.includes("token-code-verifier") || k.includes("code_verifier")
      ),
      supabaseKeys: Object.keys(localStorage).filter(k => k.startsWith("sb-")),
      oauthProgress: sessionStorage.getItem("sb_oauth_in_progress"),
      oauthStartTime: sessionStorage.getItem("sb_oauth_start_time"),
      oauthMobile: sessionStorage.getItem("sb_oauth_mobile")
    };
    
    return {
      browserInfo,
      storageTest,
      verifierChecks,
      hasAnyVerifier: !!(
        verifierChecks.supabaseVerifier || 
        verifierChecks.customVerifier || 
        verifierChecks.pkceKeys.length > 0 || 
        verifierChecks.supabaseKeys.length > 0
      ),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { error: error };
  }
}

// Mobile-specific OAuth flow debugging
export function debugMobileOAuthFlow() {
  try {
    const browserInfo = getMobileBrowserInfo();
    const pkceState = checkMobilePKCEState();
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';
    const searchParams = typeof window !== 'undefined' ? 
      Object.fromEntries(new URLSearchParams(window.location.search)) : {};
    
    return {
      browserInfo,
      pkceState,
      currentUrl,
      searchParams,
      hasCode: !!searchParams.code,
      hasError: !!searchParams.error,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { error: error };
  }
}

// Force clear all mobile authentication state
export function clearMobileAuthState() {
  try {
    const browserInfo = getMobileBrowserInfo();
    console.log('[MOBILE AUTH] Clearing mobile auth state', { browserInfo });
    
    // Clear all Supabase-related storage
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
    );
    localStorageKeys.forEach(k => localStorage.removeItem(k));
    
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
    );
    sessionStorageKeys.forEach(k => sessionStorage.removeItem(k));
    
    // Clear OAuth progress flags
    sessionStorage.removeItem("sb_oauth_in_progress");
    sessionStorage.removeItem("sb_oauth_start_time");
    sessionStorage.removeItem("sb_oauth_mobile");
    sessionStorage.removeItem("sb_oauth_retry");
    
    // Clear custom PKCE verifier
    sessionStorage.removeItem('pkce_verifier');
    
    console.log('[MOBILE AUTH] Mobile auth state cleared', {
      clearedLocalStorage: localStorageKeys,
      clearedSessionStorage: sessionStorageKeys,
      browserInfo
    });
    
    return {
      success: true,
      clearedLocalStorage: localStorageKeys,
      clearedSessionStorage: sessionStorageKeys,
      browserInfo
    };
  } catch (error) {
    console.error('[MOBILE AUTH] Error clearing mobile auth state:', error);
    return { success: false, error: error };
  }
}

// Test mobile OAuth URL generation
export async function testMobileOAuthURL() {
  try {
    const { createClient } = await import('@/lib/sb-client');
    const { siteOrigin } = await import('@/lib/site');
    
    const browserInfo = getMobileBrowserInfo();
    const sb = createClient();
    const redirectUrl = `${siteOrigin()}/auth/callback`;
    
    console.log('[MOBILE AUTH] Testing OAuth URL generation', { browserInfo, redirectUrl });
    
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        flowType: "pkce",
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    
    return {
      success: !error,
      hasData: !!data,
      hasUrl: !!data?.url,
      urlLength: data?.url?.length,
      error: error?.message,
      browserInfo,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { success: false, error: error };
  }
}

// Mobile-specific retry mechanism for PKCE verifier
export async function retryMobilePKCEVerifier(maxRetries = 3, delay = 1000) {
  const browserInfo = getMobileBrowserInfo();
  console.log('[MOBILE AUTH] Starting PKCE verifier retry', { browserInfo, maxRetries, delay });
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const pkceState = checkMobilePKCEState();
    
    if (pkceState.hasAnyVerifier) {
      console.log('[MOBILE AUTH] PKCE verifier found on attempt', attempt);
      return { success: true, attempt, pkceState };
    }
    
    if (attempt < maxRetries) {
      console.log('[MOBILE AUTH] PKCE verifier not found, retrying in', delay, 'ms (attempt', attempt, '/', maxRetries, ')');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log('[MOBILE AUTH] PKCE verifier not found after', maxRetries, 'attempts');
  return { success: false, attempts: maxRetries };
}