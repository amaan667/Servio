export function siteOrigin(): string {
  logInfo('[AUTH DEBUG] siteOrigin() called');
  logInfo('[AUTH DEBUG] NODE_ENV:', process.env.NODE_ENV);
  logInfo('[AUTH DEBUG] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
  logInfo('[AUTH DEBUG] APP_URL:', process.env.APP_URL);
  logInfo('[AUTH DEBUG] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  
  // Always use environment variables, never window.location
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app';
  logInfo('[AUTH DEBUG] Using envUrl:', envUrl);
  
  // Trim whitespace/semicolons; strip trailing slashes
  const result = envUrl.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
  logInfo('[AUTH DEBUG] Final result:', result);
  return result;
}