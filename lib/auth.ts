// Determine the app URL based on environment
export const APP_URL = (() => {
  // In development, use localhost for OAuth testing
  if (process.env.NODE_ENV === 'development') {
    const devUrl = process.env.NEXT_PUBLIC_APP_URL ||
                   process.env.NEXT_PUBLIC_SITE_URL ||
                   'http://localhost:3000';
    return devUrl;
  }

  // In production, use production URL - never fallback to localhost
  if (process.env.NODE_ENV === 'production') {
    const productionUrl = process.env.NEXT_PUBLIC_APP_URL ||
                         process.env.NEXT_PUBLIC_SITE_URL ||
                         'https://servio-production.up.railway.app';
    return productionUrl;
  }

  // Fallback for other environments (staging, etc.)
  return process.env.NEXT_PUBLIC_APP_URL ||
         process.env.NEXT_PUBLIC_SITE_URL ||
         'https://servio-production.up.railway.app';
})();


export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  const url = `${APP_URL}${path}`;
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
