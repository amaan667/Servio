'use client';

import { createClient } from '@/lib/supabase/client';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const supabase = createClient();
    
    // Clear any existing auth state
    await supabase.auth.signOut();
    
    // Use the proper OAuth flow with PKCE
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
