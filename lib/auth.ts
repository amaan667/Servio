// Determine the app URL based on environment
export const APP_URL = (() => {
  // In production, prioritize environment variables, then fallback to Railway domain
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_APP_URL || 
           process.env.NEXT_PUBLIC_SITE_URL || 
           'https://servio-production.up.railway.app';
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
  const url = `${APP_URL}${path}`;
  console.log('🔗 Auth redirect URL:', url);
  
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
