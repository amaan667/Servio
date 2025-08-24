import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST() {
  console.log('[AUTH] Sign-out request')
  const res = NextResponse.json({ ok: true })
  const supabase = getSupabaseForRoute(res)
  await supabase.auth.signOut()
  console.log('[AUTH] Session cleared')
  return res
}


