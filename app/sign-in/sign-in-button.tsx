'use client';

import { createClient } from '@/lib/supabase/client';
import { siteOrigin } from '@/lib/site';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const supabase = createClient();
    
    // Clean stale PKCE state before starting
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
          localStorage.removeItem(k);
      });
      sessionStorage.removeItem("sb_oauth_retry");
    } catch {}
    
    // Use the proper OAuth flow with PKCE
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        flowType: "pkce",
        redirectTo: `${siteOrigin()}/auth/callback`
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
