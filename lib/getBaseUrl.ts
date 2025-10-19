import { headers } from 'next/headers';

// Core resolution that can run server-side synchronously
function resolveServerBaseUrl(h?: Headers | ReturnType<typeof headers>) {
  // 1. Explicit env overrides
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // 2. Railway provided static URL
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`.replace(/\/$/, '');
  }

  // 3. Derive from incoming request headers
  const hdrs: any = h || headers();
  // Some Next types may present a promise-like; safeguard with optional chaining
  const getter = (name: string) => {
    try {
      return hdrs?.get?.(name) || (typeof hdrs === 'object' && hdrs[name]);
    } catch {
      return undefined;
    }
  };
  const xfProto = getter('x-forwarded-proto');
  const xfHost = getter('x-forwarded-host');
  const host = xfHost || getter('host') || 'servio-production.up.railway.app';
  const proto = (xfProto || 'https').split(',')[0];
  const derived = `${proto}://${host}`;

  // 4. Production safety: never allow localhost in production
  if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(derived)) {
    return 'https://servio-production.up.railway.app';
  }
  return derived.replace(/\/$/, '');
}

// Public helper (server + client)
export function getBaseUrl() {
  if (typeof window === 'undefined') return resolveServerBaseUrl();
  return window.location.origin;
}

// Server-only variant allowing passing a NextRequest or headers
export function getRequestBaseUrl(hdrs?: Headers) {
  return resolveServerBaseUrl(hdrs);
}
