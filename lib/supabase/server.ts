import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies as nextCookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

export async function createClient(c = nextCookies()) {
  const cookies = await c;
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Disable for server-side
        flowType: 'pkce',
      },
      cookies: {
        get(name) {
          return cookies.get(name)?.value
        },
        set(name, value, options: CookieOptions) {
          cookies.set(name, value, options)
        },
        remove(name, options: CookieOptions) {
          cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )
}

// Admin client for server-side operations that need elevated permissions
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
