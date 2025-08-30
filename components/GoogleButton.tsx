'use client'
import { supabase } from '@/lib/supabase/client'
import { getAuthRedirectUrl } from '@/lib/auth'

export function GoogleButton() {
  return (
    <button
      onClick={async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: getAuthRedirectUrl('/auth/callback') },
        })
      }}
    >
      Continue with Google
    </button>
  )
}
