import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST() {
  console.log('[AUTH] sign-out:begin')
  const res = NextResponse.json({ ok: true })
  try {
    const supabase = getSupabaseForRoute(res)
    await supabase.auth.signOut()
    console.log('[AUTH] sign-out:done')
  } catch (e) {
    console.error('[AUTH] sign-out:error', e)
  }
  res.headers.set('Cache-Control', 'no-store')
  return res
}


