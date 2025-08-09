export const APP_URL = 
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://servio-production.up.railway.app';

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  return `${APP_URL}${path}`;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
