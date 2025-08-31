// Determine the app URL based on environment
export const APP_URL = (() => {
  // In development, always use localhost to avoid OAuth redirect issues
  if (process.env.NODE_ENV === 'development') {
    const devUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   process.env.NEXT_PUBLIC_SITE_URL || 
                   'http://localhost:3000'; // Use current port
    console.log('🔧 DEV AUTH CONFIG: Using development URL:', devUrl);
    return devUrl;
  }
  
  // In production, use the production URL
  if (process.env.NODE_ENV === 'production') {
    const productionUrl = 'https://servio-production.up.railway.app';
    console.log('🔧 PROD AUTH CONFIG: Using production URL:', productionUrl);
    return productionUrl;
  }
  
  // Fallback
  return process.env.NEXT_PUBLIC_APP_URL || 
         process.env.NEXT_PUBLIC_SITE_URL || 
                   'http://localhost:3000';
})();

// Log configuration for debugging
console.log('🔧 AUTH CONFIG:', {
  APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
});

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  const url = `${APP_URL}${path}`;
  console.log('🔗 Auth redirect URL:', url);
  return url;
};

export const getAppUrl = (path: string = '') => {
  return `${APP_URL}${path}`;
};
