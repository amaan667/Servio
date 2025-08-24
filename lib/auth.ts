// Use NEXT_PUBLIC_APP_URL consistently
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  return `${APP_URL}${path}`;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
