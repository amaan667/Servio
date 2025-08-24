export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL!
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  
  // Handle OAuth errors
  if (error) {
    console.error('[AUTH API] OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${base}/sign-in?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, 
      { status: 307 }
    )
  }
  
  if (!code) {
    console.error('[AUTH API] No code provided in callback')
    return NextResponse.redirect(`${base}/sign-in?error=no_code`, { status: 307 })
  }

  try {
    // Prepare a redirect response we can attach cookies to
    const res = NextResponse.redirect(`${base}/dashboard`, { status: 307 })
    const supabase = getSupabaseForRoute(res)

    console.log('[AUTH API] Exchanging code for session')
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error('[AUTH API] exchangeCodeForSession failed:', exchangeError.message)
      
      // Check if it's a PKCE error - this might mean we need to handle it differently
      if (exchangeError.message?.includes('code verifier') || 
          exchangeError.message?.includes('PKCE') ||
          exchangeError.message?.includes('both auth code and code verifier')) {
        console.error('[AUTH API] PKCE verification issue - redirecting to client callback')
        // Try redirecting to client-side callback to handle it there
        return NextResponse.redirect(`${base}/auth/callback?code=${code}`, { status: 307 })
      }
      
      return NextResponse.redirect(
        `${base}/sign-in?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`, 
        { status: 307 }
      )
    }

    if (!data?.session) {
      console.error('[AUTH API] No session returned from exchange')
      return NextResponse.redirect(`${base}/sign-in?error=no_session`, { status: 307 })
    }

    console.log('[AUTH API] Session exchange successful, user:', data.session.user.email)
    console.log('[AUTH API] Setting cookies with domain:', process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : 'undefined')
    
    // The cookies are automatically set by the Supabase client through the response object
    // Redirect directly to dashboard
    return res
  } catch (error: any) {
    console.error('[AUTH API] Unexpected error during callback:', error)
    return NextResponse.redirect(
      `${base}/sign-in?error=server_error&message=${encodeURIComponent(error?.message || 'Authentication failed')}`, 
      { status: 307 }
    )
  }
}