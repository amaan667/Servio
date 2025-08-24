import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { BASE } from '@/lib/env'

export default async function DashboardIndex() {
  const supabase = createServerSupabase()
  
  console.log('[DASH] Dashboard index page loading')
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    console.log('[DASH] Auth check result:', { hasUser: !!user, error: error?.message })
    
    if (error) {
      console.error('[DASH] Auth error:', error.message)
      // If it's a refresh token error, redirect to clear sessions
      if (error.message?.includes('refresh_token_not_found') || 
          error.message?.includes('Invalid Refresh Token')) {
        redirect('/clear-sessions')
      }
      redirect(`${BASE}/sign-in`)
    }
    
    if (!user) {
      console.log('[DASH] no session → /sign-in')
      redirect(`${BASE}/sign-in`)
    }

    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (venueError) {
      console.error('[DASH] Venue query error:', venueError.message)
      redirect(`${BASE}/sign-in`)
    }

    if (!venues || venues.length === 0) {
      redirect(`${BASE}/complete-profile`)
    }

    const venueId = venues[0].venue_id as string
    console.log('[DASH] session → /dashboard/:venueId')
    redirect(`${BASE}/dashboard/${venueId}`)
  } catch (error) {
    console.error('[DASH] Unexpected error:', error)
    redirect(`${BASE}/sign-in`)
  }
}