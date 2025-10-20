// Canonical factory — import only from here everywhere in the app.
import { createServerClient as createSSRServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createBrowserClient } from '@supabase/supabase-js';

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
  return url;
}

export function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  return key;
}

// Browser (RSC/CSR safe)
export function supabaseBrowser() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: true, detectSessionInUrl: true },
  });
}

// Server in Route Handlers / Server Components with cookies
export function supabaseServer(cookies: {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, opts: CookieOptions) => void;
}) {
  return createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get: (name) => cookies.get(name),
      set: (name, value, options) => cookies.set(name, value, options),
      remove: (name, options) => cookies.set(name, '', { ...options, maxAge: 0 }),
    },
  });
}

// Admin (service role) — server-only
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return createBrowserClient(getSupabaseUrl(), key, { auth: { persistSession: false } });
}

// Backward compatibility exports
export const createClient = supabaseBrowser;
export const createSupabaseClient = supabaseServer;
export const createAdminClient = supabaseAdmin;
export const createServerSupabase = supabaseServer;

// Get authenticated user (server-side)
export async function getAuthenticatedUser() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const supabase = supabaseServer({
      get: (name) => cookieStore.get(name)?.value,
      set: () => {},
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return { user: null, error: error.message };
    }
    
    return { user, error: null };
  } catch (error) {
    return { user: null, error: 'Failed to get authenticated user' };
  }
}

// Get session (server-side)
export async function getSession() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const supabase = supabaseServer({
      get: (name) => cookieStore.get(name)?.value,
      set: () => {},
    });
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return { session: null, error: error.message };
    }
    
    return { session, error: null };
  } catch (error) {
    return { session: null, error: 'Failed to get session' };
  }
}

// Export supabase instance for backward compatibility
export const supabase = supabaseBrowser();

