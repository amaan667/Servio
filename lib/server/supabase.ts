import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const BASE = process.env.NEXT_PUBLIC_APP_URL!;
const PROD_HOST = new URL(BASE).hostname;
// For Railway subdomain, cookie should be host-only; for custom domain use `.servio.app`
const COOKIE_DOMAIN = PROD_HOST; // or `.servio.app` when you switch

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
