import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const BASE = process.env.NEXT_PUBLIC_APP_URL!
const DOMAIN = (() => {
  try {
    const u = new URL(BASE)
    return u.hostname // e.g. servio-production.up.railway.app
  } catch {
    return undefined
  }
})()

// Read-only client for Server Components/Pages — cannot mutate cookies
export function getSupabaseServerReadOnly() {
  const jar = cookies()
  return createServerClient(URL, KEY, {
    cookies: {
      get: (name: string) => jar.get(name)?.value,
      set: () => {},     // no-ops — prevents "cookies can only be modified..." crash
      remove: () => {},
    },
    auth: { flowType: 'pkce', detectSessionInUrl: false },
  })
}

// Route Handler client — can set/remove cookies via NextResponse
export function getSupabaseForRoute(res: NextResponse) {
  const jar = cookies()
  const common: Partial<CookieOptions> = {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    ...(DOMAIN ? { domain: DOMAIN } : {}),
    maxAge: 60 * 60 * 24 * 30, // 30 days
  }
  const set = (name: string, value: string, options?: CookieOptions) => {
    res.cookies.set({ name, value, ...common, ...options })
  }
  const remove = (name: string, options?: CookieOptions) => {
    res.cookies.set({ name, value: '', ...common, ...options, maxAge: 0 })
  }
  return createServerClient(URL, KEY, {
    cookies: {
      get: (n: string) => jar.get(n)?.value,
      set,
      remove,
    },
    auth: { flowType: 'pkce', detectSessionInUrl: false },
  })
}

// Backward-compatible aliases to minimize diffs across the codebase
export const createServerSupabase = getSupabaseServerReadOnly


