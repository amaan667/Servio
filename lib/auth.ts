export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}${path}`;
};

export const getAppUrl = (path: string = '') => {
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}${path}`;
};
