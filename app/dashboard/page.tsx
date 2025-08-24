import { redirect } from 'next/navigation'
import { getSupabaseServerReadOnly } from '@/lib/supabase-server'

export default async function DashboardIndex() {
  const supabase = getSupabaseServerReadOnly()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('[DASHBOARD] Auth error:', error.message)
      // If it's a refresh token error, redirect to clear sessions
      if (error.message?.includes('refresh_token_not_found') || 
          error.message?.includes('Invalid Refresh Token')) {
        redirect('/clear-sessions')
      }
      redirect('/sign-in')
    }
    
    if (!user) {
      console.log('[DASHBOARD] No user found, redirecting to sign-in')
      redirect('/sign-in')
    }

    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (venueError) {
      console.error('[DASHBOARD] Venue query error:', venueError.message)
      redirect('/sign-in')
    }

    if (!venues || venues.length === 0) {
      redirect('/complete-profile')
    }

    const venueId = venues[0].venue_id as string
    redirect(`/dashboard/${venueId}`)
  } catch (error) {
    console.error('[DASHBOARD] Unexpected error:', error)
    redirect('/sign-in')
  }
}