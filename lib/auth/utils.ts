// /lib/auth/utils.ts
import type { Headers } from 'next/dist/server/web/spec-extension/adapters/headers';

const AUTH_COOKIE_PREFIXES = ['sb-', 'supabase.auth.token', 'supabase-auth-token'];

export function getOriginFromHeaders(h: Headers) {
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('host') ?? 'localhost';
  return `${proto}://${host}`;
}

export function hasSupabaseAuthCookies(cookieNames: string[]) {
  return cookieNames.some((n) => AUTH_COOKIE_PREFIXES.some((p) => n.startsWith(p)));
}