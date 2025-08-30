export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getRequestOrigin } from '@/lib/origin'

function getOrigin(req: NextRequest) {
  return getRequestOrigin(req)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  const origin = getOrigin(req)

  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`)

  if (error) {
    return redirect('/auth/error?reason=' + encodeURIComponent(errorDescription || error))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { flowType: 'pkce' },
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name)
          return cookie?.value
        },
        set(name: string, value: string, options: any) {
          const cookieOptions = {
            ...options,
            sameSite: 'lax' as const,
            secure: true,
            httpOnly: true,
            path: '/',
            maxAge: options?.maxAge ?? 60 * 60 * 24 * 7,
          }
          cookieStore.set(name, value, cookieOptions)
        },
        remove(name: string, options: any) {
          cookieStore.set(name, '', {
            ...options,
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
            secure: true,
            httpOnly: true,
          })
        },
      },
    }
  )

  // Avoid duplicate exchanges
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    return redirect('/dashboard')
  }

  if (!code) {
    const hasAccessToken = url.searchParams.get('access_token') || url.hash.includes('access_token=')
    if (hasAccessToken) return redirect('/auth/callback')
    return redirect('/auth/error?reason=missing_code')
  }

  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return redirect('/auth/error?reason=' + encodeURIComponent(exchangeError.message))
    }
  } catch {
    return redirect('/auth/error?reason=' + encodeURIComponent('unexpected_error'))
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return redirect('/auth/error?reason=session_verification_failed')
  if (!sessionData.session) return redirect('/auth/error?reason=no_session_after_exchange')

  return redirect('/dashboard')
}

