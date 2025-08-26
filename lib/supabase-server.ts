import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[SUPABASE SERVER] Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
}

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  );
}

export function createClientAction() {
  const cookieStore = cookies();

  return createServerClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  );
}

// Legacy function names for backward compatibility
export function createServerSupabase() {
  const jar = cookies();
  
  return createServerClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        // Do NOT call set/remove from server components.
        // Only route handlers should pass working set/remove fns.
        set: () => {},
        remove: () => {},
      },
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  );
}

export function createRouteSupabase() {
  const jar = cookies();
  
  return createServerClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, opts) => jar.set(n, v, opts),
        remove: (n, opts) => jar.set(n, '', { ...opts, maxAge: 0 }),
      },
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  );
}


