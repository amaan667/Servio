export function siteOrigin(): string {
  // In production, always prioritize environment variables over window.location
  if (process.env.NODE_ENV === 'production') {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) {
      return envUrl.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
    }
  }
  
  // Fallback to window.location.origin for development
  const raw =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "");
  // Trim whitespace/semicolons; strip trailing slashes
  return raw.trim().replace(/[;\s]+$/g, "").replace(/\/+$/g, "");
}