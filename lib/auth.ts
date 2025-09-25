// Determine the app URL based on environment
export const APP_URL = (() => {
  // In development, always use localhost to avoid OAuth redirect issues
  if (process.env.NODE_ENV === 'development') {
    const devUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   process.env.NEXT_PUBLIC_SITE_URL || 
                   'http://localhost:3000'; // Use current port
    return devUrl;
  }
  
  // In production, use the production URL
  if (process.env.NODE_ENV === 'production') {
    const productionUrl = 'https://servio-production.up.railway.app';
    return productionUrl;
  }
  
  // Fallback
  return process.env.NEXT_PUBLIC_APP_URL || 
         process.env.NEXT_PUBLIC_SITE_URL || 
                   'http://localhost:3000';
})();


export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  const url = `${APP_URL}${path}`;
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
