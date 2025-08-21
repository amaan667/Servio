import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const BASE = process.env.NEXT_PUBLIC_APP_URL!;
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
          // Only allow cookie modification in route handlers
          if (!isRouteHandler()) {
            console.warn('[SUPABASE SERVER] Cookie set blocked - not in route handler');
            return;
          }
          try {
            cookieStore.set({
              name,
              value,
              ...options,
              domain: COOKIE_DOMAIN,
              secure: true,
              sameSite: 'lax',
            });
          } catch (error) {
            console.warn('[SUPABASE SERVER] Cookie set failed:', error);
          }
        },
        remove(name, options) {
          // Only allow cookie modification in route handlers
          if (!isRouteHandler()) {
            console.warn('[SUPABASE SERVER] Cookie remove blocked - not in route handler');
            return;
          }
          try {
            cookieStore.set({
              name,
              value: '',
              ...options,
              domain: COOKIE_DOMAIN,
              secure: true,
              sameSite: 'lax',
              maxAge: 0,
            });
          } catch (error) {
            console.warn('[SUPABASE SERVER] Cookie remove failed:', error);
          }
        },
      },
    }
  );
};

// Keep the old function name for backward compatibility
export function createServerSupabaseClient() {
  return supabaseServer();
}
