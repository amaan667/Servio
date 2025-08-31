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
        get(name: string) { 
          try {
            return cookieStore.get(name)?.value; 
          } catch (error) {
            console.error('[SUPABASE SERVER] Error getting cookie:', error);
            return undefined;
          }
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, { 
              ...options, 
              sameSite: 'lax', 
              secure: process.env.NODE_ENV === 'production',
              httpOnly: false, // Allow client-side access for auth
              path: '/'
            });
          } catch (error) {
            console.error('[SUPABASE SERVER] Error setting cookie:', error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { 
              ...options, 
              maxAge: 0, 
              sameSite: 'lax', 
              secure: process.env.NODE_ENV === 'production',
              httpOnly: false,
              path: '/'
            });
          } catch (error) {
            console.error('[SUPABASE SERVER] Error removing cookie:', error);
          }
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

// SECURE: Use getUser() instead of getSession() for authentication
export async function getAuthenticatedUser() {
  try {
    const cookieStore = await cookies();
    const cookieNames = cookieStore.getAll().map(c => c.name);
    
    if (!hasSupabaseAuthCookies(cookieNames)) {
      return { user: null, error: 'No auth cookies' };
    }
    
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('[SUPABASE SERVER] Error getting user:', error);
      return { user: null, error: error.message };
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('[SUPABASE SERVER] Error in getAuthenticatedUser:', error);
    return { user: null, error: 'Failed to get authenticated user' };
  }
}

// Helper function to get session (use sparingly, prefer getUser() for auth checks)
export async function getSession() {
  try {
    const supabase = await createServerSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[SUPABASE SERVER] Error getting session:', error);
      return { session: null, error: error.message };
    }
    
    return { session, error: null };
  } catch (error) {
    console.error('[SUPABASE SERVER] Error in getSession:', error);
    return { session: null, error: 'Failed to get session' };
  }
}

// Helper function to refresh session
export async function refreshSession() {
  try {
    const supabase = await createServerSupabase();
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('[SUPABASE SERVER] Error refreshing session:', error);
      return { session: null, error: error.message };
    }
    
    return { session, error: null };
  } catch (error) {
    console.error('[SUPABASE SERVER] Error in refreshSession:', error);
    return { session: null, error: 'Failed to refresh session' };
  }
}

// Alias for backward compatibility with existing API routes
export const createClient = createServerSupabase;

