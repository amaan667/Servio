'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      // 1) Implicit flow: tokens in URL hash
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.slice(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (!error) {
            router.replace('/dashboard')
            return
          }
        }
      }

      // 2) PKCE flow: code in query string
      const href = typeof window !== 'undefined' ? window.location.href : ''
      if (href) {
        const url = new URL(href)
        const code = url.searchParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) {
            router.replace('/dashboard')
            return
          }
        }
      }

      // 3) Fallback
      router.replace('/sign-in?error=no_code_or_tokens')
    }

    run()
  }, [router])

  return null
}
