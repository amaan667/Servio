// Determine the app URL based on environment
export const APP_URL = (() => {
  // Always prefer explicit env vars
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // On client-side, use current origin (never localhost in production!)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side fallback to production URL
  return "https://servio-production.up.railway.app";
})();

export const getAuthRedirectUrl = (path: string = "/auth/callback") => {
  // ALWAYS use current origin on client-side to prevent localhost issues
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }

  // Server-side: use APP_URL
  const url = `${APP_URL}${path}`;
  return url;
};

export const getAppUrl = (path: string = "") => {
  return `${APP_URL}${path}`;
};
