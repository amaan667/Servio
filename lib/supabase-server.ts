import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function createServerSupabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

export async function createRouteSupabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, opts) => jar.set(n, v, opts),
        remove: (n, opts) => jar.set(n, '', { ...opts, maxAge: 0 }),
      },
    }
  );
}


