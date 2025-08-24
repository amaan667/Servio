import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  const supabase = getSupabaseForRoute(response)
  await supabase.auth.signOut()
  return response
}


