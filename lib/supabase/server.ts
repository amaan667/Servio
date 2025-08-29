import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
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

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
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
