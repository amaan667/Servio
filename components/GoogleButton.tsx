'use client'
import { supabase } from '@/lib/supabase/client'

export function GoogleButton() {
  return (
    <button
      onClick={async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
      }}
    >
      Continue with Google
    </button>
  )
}
