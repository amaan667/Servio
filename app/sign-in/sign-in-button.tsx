'use client';

import { createClient } from '@/lib/supabase/client';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const supabase = createClient();
    
    // Clear any existing auth state
    await supabase.auth.signOut();
    
    // Clean stale PKCE state before starting
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
          localStorage.removeItem(k);
      });
    } catch {}
    
    const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
    
    // Use the proper OAuth flow with PKCE
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        flowType: "pkce",
        redirectTo: `${origin}/auth/callback`,
        queryParams: { 
          prompt: 'select_account',
          access_type: 'offline'
        },
        skipBrowserRedirect: false
      }
    });
    
    if (error) {
      console.error('[AUTH DEBUG] OAuth error:', error);
    }
  };

  return (
    <button 
      type="button"
      onClick={onGoogle} 
      className="px-4 py-2 rounded bg-black text-white"
    >
      Sign in with Google
    </button>
  );
}
