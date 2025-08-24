import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ENV } from './env';

export function supabaseServer() {
  const jar = cookies();
  return createServerClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON, {
    cookies: {
      get: (name) => jar.get(name)?.value,
      set: (name, value, options: CookieOptions) => jar.set(name, value, options),
      remove: (name, options: CookieOptions) => jar.set(name, '', { ...options, maxAge: 0 }),
    },
  });
}


