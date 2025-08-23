export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export async function POST() {
  try {
    const res = NextResponse.json({ success: true })
    const supabase = getSupabaseForRoute(res)
    
    // Sign out to clear any server-side session
    await supabase.auth.signOut()
    
    console.log('[API] Session cleared successfully')
    return res
  } catch (error) {
    console.error('[API] Error clearing session:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear session' }, { status: 500 })
  }
}