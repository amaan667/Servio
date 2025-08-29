export function siteOrigin(): string {
  console.log('[AUTH DEBUG] siteOrigin() called');
  console.log('[AUTH DEBUG] NODE_ENV:', process.env.NODE_ENV);
  console.log('[AUTH DEBUG] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
  console.log('[AUTH DEBUG] APP_URL:', process.env.APP_URL);
  console.log('[AUTH DEBUG] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  
  // Always use environment variables, never window.location
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app';
  console.log('[AUTH DEBUG] Using envUrl:', envUrl);
  
  // Trim whitespace/semicolons; strip trailing slashes
  const result = envUrl.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
  console.log('[AUTH DEBUG] Final result:', result);
  return result;
}