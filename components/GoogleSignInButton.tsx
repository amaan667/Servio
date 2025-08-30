'use client'
import { supabase } from '@/lib/supabase/client'

export function GoogleSignInButton() {
  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return <button onClick={handleSignIn}>Sign in with Google</button>
}
