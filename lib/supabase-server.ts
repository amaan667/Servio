import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Use in Server Components/Pages (read-only; no cookie mutations)
export function getSupabaseServerReadOnly() {
  const jar = cookies()
  return createServerClient(URL, KEY, {
    cookies: {
      get: (name: string) => jar.get(name)?.value,
      set: () => {},     // no-op in pages
      remove: () => {},  // no-op in pages
    },
    auth: { flowType: 'pkce' },
  })
}

// Use inside Route Handlers to mutate cookies via NextResponse
export function getSupabaseForRoute(res: NextResponse) {
  const jar = cookies()
  const set = (name: string, value: string, options?: CookieOptions) => {
    res.cookies.set({
      name,
      value,
      ...options,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    })
  }
  const remove = (name: string, options?: CookieOptions) => {
    res.cookies.set({
      name,
      value: '',
      ...options,
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    })
  }
  return createServerClient(URL, KEY, {
    cookies: {
      get: (n: string) => jar.get(n)?.value,
      set,
      remove,
    },
    auth: { flowType: 'pkce' },
  })
}

// Backward-compatible aliases to minimize diffs across the codebase
export const createServerSupabase = getSupabaseServerReadOnly


