export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const base = process.env.NEXT_PUBLIC_APP_URL!

  // Always build a NextResponse we can attach cookies to
  let redirectTo = `${base}/dashboard`
  const res = NextResponse.redirect(redirectTo, { status: 307 })

  if (!code) {
    return NextResponse.redirect(`${base}/sign-in?error=no_code`, { status: 307 })
  }

  const supabase = getSupabaseForRoute(res)
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      `${base}/sign-in?error=${encodeURIComponent(error.message)}`,
      { status: 307 },
    )
  }
  // success → /dashboard; cookies already set on res
  return res
}