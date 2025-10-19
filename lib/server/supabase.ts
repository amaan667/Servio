import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { logger } from '@/lib/logger';

// Avoid throwing at import-time to keep webpack builds stable. We rely on
// runtime environment correctness and server route handlers for validation.
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app';
const COOKIE_DOMAIN = new URL(baseUrl).hostname;

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

export const supabaseServer = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Handle missing environment variables gracefully
  if (!supabaseUrl || !supabaseAnonKey) {
    logger.warn('[SUPABASE SERVER] Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey
    });
    // Return a mock client for build time
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
        updateUser: async () => ({ data: null, error: new Error('Supabase not configured') })
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) })
      })
    } as any;
  }

  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        flowType: 'pkce',
      },
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
export async function createServerSupabaseClient() {
  return await supabaseServer();
}

// Export a cookie adapter for use in Route Handlers that directly construct Supabase clients
// with custom cookie handling.
export function cookieAdapter(jar: any) {
  return {
    get(name: string) {
      return jar.get(name)?.value;
    },
    set(name: string, value: string, options?: any) {
      // Route handlers may set cookies safely
      jar.set({
        name,
        value,
        ...options,
        domain: COOKIE_DOMAIN,
        secure: true,
        sameSite: 'lax',
      });
    },
    remove(name: string, options?: any) {
      jar.set({
        name,
        value: '',
        ...options,
        domain: COOKIE_DOMAIN,
        secure: true,
        sameSite: 'lax',
        maxAge: 0,
      });
    },
  };
}
