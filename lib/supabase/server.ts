import { createServerClient } from '@supabase/ssr'
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
