import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function DashboardIndex() {
  const supabase = createServerSupabase()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('[NAV] no session -> /sign-in')
      redirect('/sign-in')
    }

    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (venueError) {
      console.error('[NAV] Venue query error:', venueError.message)
      redirect('/sign-in')
    }

    if (!venues || venues.length === 0) {
      redirect('/complete-profile')
    }

    const venueId = venues[0].venue_id as string
    console.log(`[NAV] redirecting to /dashboard/${venueId}`)
    redirect(`/dashboard/${venueId}`)
  } catch (error) {
    console.error('[NAV] Unexpected error:', error)
    redirect('/sign-in')
  }
}