export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL!
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(`${base}/sign-in?error=no_code`, { status: 307 })
  }

  // Prepare a redirect response we can attach cookies to
  const res = NextResponse.redirect(`${base}/dashboard`, { status: 307 })
  const supabase = getSupabaseForRoute(res)

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[AUTH] callback exchangeCodeForSession failed:', error.message)
    return NextResponse.redirect(`${base}/sign-in?error=${encodeURIComponent(error.message)}`, { status: 307 })
  }

  console.log('[AUTH] callback OK, set cookies domain=' + (process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : 'undefined'))
  return res // cookies (access/refresh) are set here with proper domain!
}