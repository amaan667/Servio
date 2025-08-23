export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export async function POST() {
  const base = process.env.NEXT_PUBLIC_APP_URL!
  const res = NextResponse.redirect(`${base}/`, { status: 307 })
  const supabase = getSupabaseForRoute(res)
  await supabase.auth.signOut()
  return res
}


