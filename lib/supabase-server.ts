import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Environment variables - ALWAYS use these exact names
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate at runtime inside factories to avoid import-time throws
const hasServerEnv = !!supabaseUrl && !!supabaseAnonKey;

export function createServerSupabase() {
  const jar = cookies();
  if (!hasServerEnv) {
    throw new Error("Missing Supabase server utilities configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
  }
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        // Do NOT call set/remove from server components.
        // Only route handlers should pass working set/remove fns.
        set: () => {},
        remove: () => {},
      },
    }
  );
}

export function createRouteSupabase() {
  const jar = cookies();
  if (!hasServerEnv) {
    throw new Error("Missing Supabase server utilities configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
  }
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, opts) => jar.set(n, v, opts),
        remove: (n, opts) => jar.set(n, '', { ...opts, maxAge: 0 }),
      },
    }
  );
}


