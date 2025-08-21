import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const PROD_BASE = 'https://servio-production.up.railway.app';
const BASE = process.env.NEXT_PUBLIC_APP_URL!;
if (process.env.NODE_ENV === 'production') {
  if (!BASE || BASE !== PROD_BASE) {
    throw new Error('NEXT_PUBLIC_APP_URL must be https://servio-production.up.railway.app in production');
  }
}
const PROD_HOST = new URL(BASE).hostname;
const COOKIE_DOMAIN = PROD_HOST;

// Check if we're in a route handler context
const isRouteHandler = () => {
  try {
    // This will throw if we're not in a route handler
    const { headers } = require('next/headers');
    return true;
  } catch {
    return false;
  }
};

export const supabaseServer = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          // Only set cookies in a Route Handler; silently no-op otherwise to avoid log noise
          if (!isRouteHandler()) return;
          cookieStore.set({
            name,
            value,
            ...options,
            domain: COOKIE_DOMAIN,
            secure: true,
            sameSite: 'lax',
          });
        },
        remove(name, options) {
          // Only remove cookies in a Route Handler; silently no-op otherwise
          if (!isRouteHandler()) return;
          cookieStore.set({
            name,
            value: '',
            ...options,
            domain: COOKIE_DOMAIN,
            secure: true,
            sameSite: 'lax',
            maxAge: 0,
          });
        },
      },
    }
  );
};

// Keep the old function name for backward compatibility
export function createServerSupabaseClient() {
  return supabaseServer();
}
