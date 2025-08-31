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
      throw new Error('Missing Supabase environment variables');
    }
    
    console.log('[SUPABASE] Creating browser client with URL:', supabaseUrl);
    
    supabaseBrowserInstance = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false, // Disable session persistence to prevent auto sign-in
          autoRefreshToken: false, // Disable auto refresh to prevent auto sign-in
          detectSessionInUrl: false, // Disable session detection in URL
          flowType: 'pkce', // Use PKCE for better security
          storage: {
            getItem: (key: string) => {
              // Allow PKCE verifier to be read back during OAuth exchange
              if (key.includes('token-code-verifier')) {
                return localStorage.getItem(key);
              }
              // Block other auth/session keys from being read to avoid auto sign-in
              if (key.includes('auth') || key.includes('supabase') || key.startsWith('sb-')) {
                return null;
              }
              return localStorage.getItem(key);
            },
            setItem: (key: string, value: string) => {
              // Persist ONLY the PKCE verifier required for OAuth code exchange
              if (key.includes('token-code-verifier')) {
                localStorage.setItem(key, value);
                return;
              }
              // Block other auth/session keys from being written
              if (key.includes('auth') || key.includes('supabase') || key.startsWith('sb-')) {
                console.log('[SUPABASE] Blocking auth state persistence for key:', key);
                return;
              }
              localStorage.setItem(key, value);
            },
            removeItem: (key: string) => {
              localStorage.removeItem(key);
            },
          },
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
    if (supabaseBrowserInstance) {
      await supabaseBrowserInstance.auth.signOut();
    }
    
    // Clear any remaining auth-related storage
    const authKeys = Object.keys(localStorage).filter(k => 
      (k.includes('auth') || k.includes('supabase') || k.startsWith('sb-') || k.includes('pkce'))
      // Preserve PKCE verifier so ongoing OAuth flows don't break
      && !k.includes('token-code-verifier')
    );
    
    authKeys.forEach(key => {
      console.log('[SUPABASE] Clearing auth key:', key);
      localStorage.removeItem(key);
    });
    
    // Clear sessionStorage
    const sessionAuthKeys = Object.keys(sessionStorage).filter(k => 
      (k.includes('auth') || k.includes('supabase') || k.startsWith('sb-') || k.includes('pkce'))
      && !k.includes('token-code-verifier')
    );
    
    sessionAuthKeys.forEach(key => {
      console.log('[SUPABASE] Clearing session auth key:', key);
      sessionStorage.removeItem(key);
    });
    
    // Clear cookies
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      cookies.forEach(cookie => {
        const [name] = cookie.split('=');
        if (name.trim().startsWith('sb-') || name.trim().includes('auth')) {
          document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          console.log('[SUPABASE] Cleared auth cookie:', name.trim());
        }
      });
    }
    
    console.log('[SUPABASE] Auth state cleared successfully');
  } catch (error) {
    console.error('[SUPABASE] Error clearing auth state:', error);
  }
};
