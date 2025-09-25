import { createBrowserClient } from '@supabase/ssr';

let supabaseBrowserInstance: ReturnType<typeof createBrowserClient> | null = null;

export const supabaseBrowser = () => {
  if (typeof window === 'undefined') {
    throw new Error('supabaseBrowser can only be used in the browser');
  }
  
  if (!supabaseBrowserInstance) {
    // Check if environment variables are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[SUPABASE] Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      });
      // Instead of throwing error, return a mock client that doesn't crash
      console.warn('[SUPABASE] Using fallback client due to missing environment variables');
      return {
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
          getUser: async () => ({ data: { user: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signOut: async () => ({ error: null }),
          refreshSession: async () => ({ data: { session: null }, error: null })
        },
        from: () => ({
          select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
          update: () => ({ eq: () => ({ select: async () => ({ data: null, error: null }) }) }),
          delete: () => ({ eq: async () => ({ error: null }) })
        })
      } as any;
    }
    
    
    supabaseBrowserInstance = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: true, // Enable session persistence for better UX
          autoRefreshToken: true, // Enable auto refresh for seamless experience
          detectSessionInUrl: true, // Enable session detection for OAuth flows
          flowType: 'pkce', // Use PKCE for better security
          storage: {
            getItem: (key: string) => {
              try {
                // Allow all auth-related keys to be read for proper session management
                return localStorage.getItem(key);
              } catch (error) {
                console.error('[SUPABASE] Error reading from storage:', error);
                return null;
              }
            },
            setItem: (key: string, value: string) => {
              try {
                localStorage.setItem(key, value);
              } catch (error) {
                console.error('[SUPABASE] Error writing to storage:', error);
              }
            },
            removeItem: (key: string) => {
              try {
                localStorage.removeItem(key);
              } catch (error) {
                console.error('[SUPABASE] Error removing from storage:', error);
              }
            },
          },
        },
        // Disable cookie operations on client side to prevent Next.js App Router errors
        // Cookies will be handled by server-side APIs
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {}
        },
        global: {
          headers: {
            'X-Client-Info': 'servio-web-app',
          },
        },
      }
    );
  }
  
  return supabaseBrowserInstance;
};

// Function to clear Supabase auth state
export const clearSupabaseAuth = async () => {
  try {
    
    // Use server-side signout API to properly clear cookies
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
      } else {
      }
    } catch (error) {
    }
    
    // Clear any remaining auth-related storage
    const authKeys = Object.keys(localStorage).filter(k => 
      (k.includes('auth') || k.includes('supabase') || k.startsWith('sb-') || k.includes('pkce'))
    );
    
    authKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Clear sessionStorage
    const sessionAuthKeys = Object.keys(sessionStorage).filter(k => 
      (k.includes('auth') || k.includes('supabase') || k.startsWith('sb-') || k.includes('pkce'))
    );
    
    sessionAuthKeys.forEach(key => {
      sessionStorage.removeItem(key);
    });
    
  } catch (error) {
    console.error('[SUPABASE] Error clearing auth state:', error);
  }
};

// Function to check if user is authenticated
export const checkAuthStatus = async () => {
  try {
    const supabase = supabaseBrowser();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('[SUPABASE] Error checking auth status:', error);
      return { isAuthenticated: false, error };
    }
    
    return { 
      isAuthenticated: !!user, 
      user,
      session: null // We don't need session data for authentication check
    };
  } catch (error) {
    console.error('[SUPABASE] Error checking auth status:', error);
    return { isAuthenticated: false, error };
  }
};

// Function to refresh session
export const refreshSession = async () => {
  try {
    const supabase = supabaseBrowser();
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('[SUPABASE] Error refreshing session:', error);
      return { session: null, error };
    }
    
    return { session, error: null };
  } catch (error) {
    console.error('[SUPABASE] Error refreshing session:', error);
    return { session: null, error };
  }
};
