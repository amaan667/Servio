// Determine the app URL based on environment
export const APP_URL = (() => {
  // Always use the production URL in production to avoid localhost issues
  if (process.env.NODE_ENV === 'production') {
    // Force Railway production URL to prevent any localhost redirects
    return 'https://servio-production.up.railway.app';
  }
  
  // In development, use localhost
  return process.env.NEXT_PUBLIC_APP_URL || 
         process.env.NEXT_PUBLIC_SITE_URL || 
         'http://localhost:3000';
})();

console.log('🔧 AUTH CONFIG:', {
  APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
});

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  // In production, always use the Railway URL to prevent localhost issues
  if (process.env.NODE_ENV === 'production') {
    const productionUrl = `https://servio-production.up.railway.app${path}`;
    console.log('🔗 Auth redirect URL (production):', productionUrl);
    return productionUrl;
  }
  
  // Only use APP_URL in development
  const url = `${APP_URL}${path}`;
  console.log('🔗 Auth redirect URL (development):', url);
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
