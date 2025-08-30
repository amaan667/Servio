'use client';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginButton() {
  const signIn = async () => {
    try {
      console.log('[SIGN-IN] Starting OAuth flow');
      
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('[SIGN-IN] Redirect URL:', redirectUrl);
      
      const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        },
      });
      
      if (error) {
        console.error('[SIGN-IN] OAuth error:', error);
        alert(`Sign in failed: ${error.message}`);
        return;
      }
      
      console.log('[SIGN-IN] OAuth initiated successfully:', data);
    } catch (err: any) {
      console.error('[SIGN-IN] Unexpected error:', err);
      alert(`Unexpected error: ${err.message}`);
    }
  };
  
  return <button onClick={signIn}>Sign in with Google</button>;
}
