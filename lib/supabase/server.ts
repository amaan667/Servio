import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, { ...options, sameSite: 'lax', secure: true });
        },
        remove(name: string, options: any) {
          cookieStore.set(name, '', { ...options, maxAge: 0, sameSite: 'lax', secure: true });
        },
      },
    }
  );
}

// Admin client for server-side operations that need elevated permissions
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) { return undefined; },
        set(name: string, value: string, options: any) { },
        remove(name: string, options: any) { },
      },
    }
  )
}

// Helper function to get user with cookie guard
export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map(c => c.name);
  
  if (!hasSupabaseAuthCookies(cookieNames)) {
    return { user: null, error: 'No auth cookies' };
  }
  
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

// Alias for backward compatibility with existing API routes
export const createClient = createServerSupabase;

