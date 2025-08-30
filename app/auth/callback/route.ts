export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/getBaseUrl'

export async function GET(req: Request) {
  const baseUrl = getBaseUrl()
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const err  = url.searchParams.get('error')

  if (err) return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(err)}`)
  if (!code) return NextResponse.redirect(`${baseUrl}/`)

  const supabase = createClient(cookies())
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=exchange_failed&reason=${encodeURIComponent(error.message)}`
    )
  }
  return NextResponse.redirect(`${baseUrl}/dashboard`)
}
