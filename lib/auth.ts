// Determine the app URL based on environment
export const APP_URL = (() => {
  // Always use the production URL in production to avoid localhost issues
  if (process.env.NODE_ENV === 'production') {
    // Force Railway production URL to prevent any localhost redirects
    return 'https://servio-production.up.railway.app';
  }
  
  // In development, prefer APP_URL/NEXT_PUBLIC_APP_URL; avoid defaulting to localhost
  const devUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 process.env.NEXT_PUBLIC_SITE_URL || 
                 process.env.APP_URL ||
                 'https://servio-production.up.railway.app';
  
  // Clean up any semicolons or extra characters
  return devUrl.replace(/[;,\s]+$/, '');
})();

console.log('🔧 AUTH CONFIG:', {
  APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.replace(/[;,\s]+$/, ''),
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.replace(/[;,\s]+$/, ''),
  NODE_ENV: process.env.NODE_ENV,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
});

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  // In production, ALWAYS use the Railway URL - never localhost
  if (process.env.NODE_ENV === 'production') {
    const productionUrl = `https://servio-production.up.railway.app${path}`;
    console.log('🔗 Auth redirect URL (production):', productionUrl);
    return productionUrl;
  }
  
  // In development, use APP_URL but ensure it's not localhost in production
  const url = `${APP_URL}${path}`;
  console.log('🔗 Auth redirect URL (development):', url);
  
  // Extra safety check - never allow localhost in production
  if (process.env.NODE_ENV === 'production' && url.includes('localhost')) {
    const fallbackUrl = `https://servio-production.up.railway.app${path}`;
    console.warn('⚠️ Prevented localhost in production, using fallback:', fallbackUrl);
    return fallbackUrl;
  }
  
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};

// Utility function to clear invalid auth tokens
export const clearAuthTokens = (response: any) => {
  const authCookies = [
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
    'supabase-auth-refresh-token'
  ];
  
  authCookies.forEach(cookieName => {
    response.cookies.set(cookieName, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  });
  
  console.log('[AUTH DEBUG] Cleared invalid auth tokens');
};

// Check if an error is related to invalid refresh tokens
export const isInvalidTokenError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const errorCode = error.code || '';
  
  return (
    errorMessage.includes('Refresh Token Not Found') ||
    errorMessage.includes('Invalid Refresh Token') ||
    errorCode === 'refresh_token_not_found' ||
    errorCode === 'invalid_refresh_token'
  );
};

// Check if an error is related to timeout
export const isTimeoutError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const errorCode = error.code || '';
  
  return (
    errorMessage.includes('timeout') ||
    errorMessage.includes('Timeout') ||
    errorCode === 'timeout' ||
    errorCode === 'TIMEOUT'
  );
};

// Check if an error is retryable
export const isRetryableError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const errorStatus = error.status || error.statusCode;
  
  return (
    isTimeoutError(error) ||
    errorMessage.includes('network') ||
    errorMessage.includes('Network') ||
    errorStatus === 408 || // Request Timeout
    errorStatus === 500 || // Internal Server Error
    errorStatus === 502 || // Bad Gateway
    errorStatus === 503 || // Service Unavailable
    errorStatus === 504    // Gateway Timeout
  );
};

// Handle auth errors in components
export const handleAuthError = async (error: any, router?: any) => {
  console.log('[AUTH DEBUG] Handling auth error:', error);
  
  if (isInvalidTokenError(error)) {
    console.log('[AUTH DEBUG] Invalid token error detected, clearing tokens');
    
    // Try to clear tokens via API
    try {
      await fetch('/api/auth/clear-tokens', { method: 'POST' });
    } catch (clearError) {
      console.error('[AUTH DEBUG] Failed to clear tokens via API:', clearError);
    }
    
    // Redirect to sign-in if router is provided
    if (router) {
      router.push('/sign-in?error=invalid_token');
    }
    
    return true; // Error was handled
  }
  
  if (isTimeoutError(error)) {
    console.log('[AUTH DEBUG] Timeout error detected');
    
    // Redirect to sign-in with timeout error if router is provided
    if (router) {
      router.push('/sign-in?error=timeout&message=Authentication timed out. Please try again.');
    }
    
    return true; // Error was handled
  }
  
  return false; // Error was not handled
};
