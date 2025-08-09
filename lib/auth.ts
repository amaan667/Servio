export const APP_URL = 
  process.env.NEXT_PUBLIC_APP_URL ?? 
  (typeof window !== 'undefined' && window.location.origin.includes('localhost') 
    ? window.location.origin 
    : 'https://servio-production.up.railway.app');

console.log('🔧 AUTH CONFIG:', {
  APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV
});

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  const url = `${APP_URL}${path}`;
  console.log('🔗 Auth redirect URL:', url);
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
