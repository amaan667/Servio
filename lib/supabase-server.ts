import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function createServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Handle missing environment variables gracefully
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[SUPABASE SERVER] Missing environment variables:', {
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

  const jar = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        flowType: 'pkce',
      },
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Handle missing environment variables gracefully
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[SUPABASE ROUTE] Missing environment variables:', {
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

  const jar = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        flowType: 'pkce',
      },
      cookies: {
        get: (n: any) => jar.get(n)?.value,
        set: (n: any, v: any, opts: any) => jar.set(n, v, opts),
        remove: (n: any, opts: any) => jar.set(n, '', { ...opts, maxAge: 0 }),
      } as any,
    }
  );
}


