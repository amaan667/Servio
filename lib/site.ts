export function siteOrigin(): string {
  
  // Always use environment variables, never window.location
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app';
  
  // Trim whitespace/semicolons; strip trailing slashes
  const result = envUrl.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
  return result;
}