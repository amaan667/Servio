// Determine the app URL based on environment
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 
                       process.env.NEXT_PUBLIC_SITE_URL || 
                       (typeof window !== 'undefined' ? window.location.origin : 'https://servio-production.up.railway.app');

console.log('🔧 AUTH CONFIG:', {
  APP_URL,
  NODE_ENV: process.env.NODE_ENV,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

export const getAuthRedirectUrl = (path: string = '/api/auth/callback') => {
  const url = `${APP_URL}${path}`;
  console.log('🔗 Auth redirect URL:', url);
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
