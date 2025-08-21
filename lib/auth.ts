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
