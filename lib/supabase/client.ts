import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// Keep the old createClient function for backward compatibility
export function createClient() {
  return supabase;
}

// Backward compatibility functions for existing code
export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.startsWith("sb-") || k.includes("pkce") || k.includes("auth")
    );
    localStorageKeys.forEach(k => localStorage.removeItem(k));
    
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("pkce") || k.includes("auth")
    );
    sessionStorageKeys.forEach(k => sessionStorage.removeItem(k));
  } catch (error) {
    // Silent error handling
  }
}

export function checkPKCEState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const oauthProgress = sessionStorage.getItem("sb_oauth_in_progress");
    const pkceKeys = {
      supabaseVerifier: localStorage.getItem("supabase.auth.token-code-verifier"),
      authToken: localStorage.getItem("sb-auth-token"),
    };
    
    return {
      timestamp: new Date().toISOString(),
      oauthInProgress: oauthProgress === "true",
      pkceKeys,
      localStorage: {
        size: Object.keys(localStorage).length,
        authKeys: Object.keys(localStorage).filter(k => k.includes('auth') || k.includes('sb-')),
      },
      sessionStorage: {
        size: Object.keys(sessionStorage).length,
        authKeys: Object.keys(sessionStorage).filter(k => k.includes('auth') || k.includes('sb-')),
      }
    };
  } catch (error) {
    return { error: error.message };
  }
}

export async function checkAuthState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export function debugPKCEState() {
  return checkPKCEState();
}
