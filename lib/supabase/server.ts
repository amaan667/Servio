import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

export function createClient(c = nextCookies()) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return c.get(name)?.value },
        set(name, value, options: CookieOptions) { c.set(name, value, options) },
        remove(name, options: CookieOptions) { c.set(name, '', { ...options, maxAge: 0 }) },
      },
    }
  )
}

// Admin client for API routes that need service role access
export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Handle missing environment variables gracefully
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[SUPABASE ADMIN] Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
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

  return createServerClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {},
      },
    }
  );
}
