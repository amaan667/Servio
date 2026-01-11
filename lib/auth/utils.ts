// /lib/auth/utils.ts
// import type { Headers } from 'next/dist/server/web/spec-extension/adapters/headers';

const AUTH_COOKIE_PREFIXES = ["sb-", "supabase.auth.token", "supabase-auth-token"];

interface HeadersLike {
  get(name: string): string | null;
}

export function getOriginFromHeaders(h: HeadersLike) {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "servio-production.up.railway.app";
  return `${proto}://${host}`;
}

export function hasSupabaseAuthCookies(cookieNames: string[]) {
  return cookieNames.some((n) => AUTH_COOKIE_PREFIXES.some((p) => n.startsWith(p)));
}

// Detect if the request is from a mobile device
export function isMobileDevice(userAgent: string): boolean {
  const mobileKeywords = [
    "android",
    "webos",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "iemobile",
    "opera mini",
    "mobile",
    "tablet",
  ];
  return mobileKeywords.some((keyword) => userAgent.toLowerCase().includes(keyword));
}

// Get platform-specific redirect URL
export function getPlatformRedirectUrl(baseUrl: string, userAgent: string): string {
  const isMobile = isMobileDevice(userAgent);

  // For mobile, you might want to redirect to a different URL or add mobile-specific parameters
  if (isMobile) {
    return `${baseUrl}?platform=mobile`;
  }

  return baseUrl;
}

// Handle authentication errors consistently
export function handleAuthError(error: unknown): { message: string; code: string } {
  const errorObj =
    error && typeof error === "object" ? (error as { message?: string; code?: string }) : {};
  const errorMessage = errorObj?.message || "Unknown authentication error";
  const errorCode = errorObj?.code || "unknown_error";

  // Map common Supabase auth errors to user-friendly messages
  switch (errorCode) {
    case "invalid_grant":
    case "refresh_token_not_found":
      return {
        message: "Your session has expired. Please sign in again.",
        code: "session_expired",
      };
    case "invalid_request":
    case "validation_failed":
      return {
        message: "Invalid authentication request. Please try again.",
        code: "invalid_request",
      };
    case "network_error":
    case "fetch_error":
      return {
        message: "Network connection issue. Please check your internet connection.",
        code: "network_error",
      };
    case "timeout_error":
      return {
        message: "Authentication timed out. Please try again.",
        code: "timeout_error",
      };
    default:
      return {
        message: errorMessage,
        code: errorCode,
      };
  }
}

interface SessionData {
  user?: { id: string };
  access_token?: string;
  expires_at?: number;
}

// Validate session data
export function validateSession(session: unknown): { isValid: boolean; error?: string } {
  if (!session) {
    return { isValid: false, error: "No session data" };
  }

  const sessionData = session as SessionData;

  if (!sessionData.user?.id) {
    return { isValid: false, error: "No user ID in session" };
  }

  if (!sessionData.access_token) {
    return { isValid: false, error: "No access token in session" };
  }

  if (sessionData.expires_at && new Date(sessionData.expires_at * 1000) < new Date()) {
    return { isValid: false, error: "Session has expired" };
  }

  return { isValid: true };
}

// Get user agent info for debugging
export function getUserAgentInfo(userAgent: string) {
  return {
    isMobile: isMobileDevice(userAgent),
    userAgent: userAgent,
    browser: getBrowserInfo(userAgent),
    os: getOSInfo(userAgent),
  };
}

function getBrowserInfo(userAgent: string): string {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Unknown";
}

function getOSInfo(userAgent: string): string {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iOS")) return "iOS";
  return "Unknown";
}
