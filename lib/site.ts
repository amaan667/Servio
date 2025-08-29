export function siteOrigin(): string {
  console.log('[AUTH DEBUG] siteOrigin() called');
  console.log('[AUTH DEBUG] NODE_ENV:', process.env.NODE_ENV);
  console.log('[AUTH DEBUG] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
  console.log('[AUTH DEBUG] APP_URL:', process.env.APP_URL);
  console.log('[AUTH DEBUG] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  
  // In production, always prioritize environment variables over window.location
  if (process.env.NODE_ENV === 'production') {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    console.log('[AUTH DEBUG] Production envUrl:', envUrl);
    if (envUrl) {
      const result = envUrl.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
      console.log('[AUTH DEBUG] Production result:', result);
      return result;
    }
  }
  
  // Fallback to window.location.origin for development
  const raw =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "");
  console.log('[AUTH DEBUG] Fallback raw:', raw);
  // Trim whitespace/semicolons; strip trailing slashes
  const result = raw.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
  console.log('[AUTH DEBUG] Final result:', result);
  return result;
}