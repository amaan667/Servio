import { headers } from "next/headers"

export function getBaseUrl() {
  // Client side: easy
  if (typeof window !== "undefined") return window.location.origin

  // Server side behind a proxy (Railway, Vercel, etc.)
  const h = headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host  = h.get("x-forwarded-host") ?? h.get("host")!  // host as fallback
  
  // Safety check - never use localhost in production
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    console.warn('[AUTH DEBUG] WARNING: Detected localhost in host header:', host)
    // Fall back to environment variable
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
    if (envUrl) {
      console.log('[AUTH DEBUG] Using environment URL as fallback:', envUrl)
      return envUrl.replace(/\/+$/, '') // Remove trailing slashes
    }
  }
  
  return `${proto}://${host}`
}
