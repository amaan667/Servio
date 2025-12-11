import type { NextRequest } from "next/server";
import { headers } from "next/headers";

// Resolve the request origin from forwarded headers (works on Railway/Proxies)
export function getRequestOrigin(req: NextRequest): string {
  const xfProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const xfHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = req.headers.get("host")?.split(",")[0]?.trim();

  const proto = xfProto || "https";
  const resolvedHost =
    xfHost ||
    host ||
    process.env.RAILWAY_STATIC_URL ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ||
    "servio-production.up.railway.app";

  return `${proto}://${resolvedHost}`;
}

// Resolve base URL in server context using Next headers; falls back to env/production URL
export async function getServerBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const xfProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const xfHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = h.get("host")?.split(",")[0]?.trim();
    if ((xfProto && (xfHost || host)) || host) {
      const proto = xfProto || "https";
      const resolvedHost = xfHost || host!;
      return `${proto}://${resolvedHost}`;
    }
  } catch (_) {
    // no-op
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "") ||
    "https://servio-production.up.railway.app"
  );
}
