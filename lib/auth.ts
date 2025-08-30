// Determine the app URL based on environment
export const APP_URL = (() => {
  // Always use the production Railway URL to prevent any localhost issues
  // This ensures OAuth callbacks always work properly
  return process.env.NEXT_PUBLIC_APP_URL || 
         process.env.NEXT_PUBLIC_SITE_URL || 
         'https://servio-production.up.railway.app';
})();

console.log('🔧 AUTH CONFIG:', {
  APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  ALWAYS_USE_PRODUCTION: true,
});

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  // Always use the Railway URL to prevent localhost issues
  const url = `${APP_URL}${path}`;
  console.log('🔗 Auth redirect URL:', url);
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
