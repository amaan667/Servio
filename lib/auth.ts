// Determine the app URL based on environment
export const APP_URL = 'https://servio-production.up.railway.app';

console.log('🔧 AUTH CONFIG:', {
  APP_URL,
  NODE_ENV: process.env.NODE_ENV,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
});

export const getAuthRedirectUrl = (path: string = '/api/auth/callback') => {
  const url = `https://servio-production.up.railway.app${path}`;
  console.log('🔗 Auth redirect URL:', url);
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
