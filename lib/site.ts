export function siteOrigin(): string {
  // For client-side, check window.location first for accuracy
  if (typeof window !== "undefined") {
    // In production, always use the production URL
    if (window.location.hostname === "servio-production.up.railway.app") {
      return "https://servio-production.up.railway.app";
    }
    // For other environments, derive from window.location
    return `${window.location.protocol}//${window.location.host}`;
  }

  // For server-side, use environment variables
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://servio-production.up.railway.app";

  // Trim whitespace/semicolons; strip trailing slashes
  const result = envUrl
    .trim()
    .replace(/[;\s]+$/g, "")
    .replace(/\/+$/g, "");
  return result;
}
