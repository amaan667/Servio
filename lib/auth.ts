export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}${path}`;
};

export const getAppUrl = (path: string = '') => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}${path}`;
};
