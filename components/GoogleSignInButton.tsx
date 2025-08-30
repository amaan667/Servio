'use client'
import { supabase } from '@/lib/supabase/client'
import { getAuthRedirectUrl } from '@/lib/auth'

export function GoogleSignInButton() {
  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl('/auth/callback') },
    })
  }

  return <button onClick={handleSignIn}>Sign in with Google</button>
}
