import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { BASE } from '@/lib/env'
import AsyncErrorBoundary from '@/components/AsyncErrorBoundary'
import DashboardClient from './page.client'

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  const supabase = createServerSupabase()
  console.log('[DASH] Venue page loading', { venueId: params.venueId })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('[DASH] Auth error:', error.message)
    redirect(`${BASE}/sign-in`)
  }
  if (!user) {
    console.log('[DASH] no session → /sign-in')
    redirect(`${BASE}/sign-in`)
  }

  const { data: venue, error: vErr } = await supabase
    .from('venues').select('*').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle()
  if (vErr) {
    console.error('[DASH] Venue query error:', vErr.message)
    redirect(`${BASE}/sign-in`)
  }
  if (!venue) {
    const { data: firstVenue } = await supabase
      .from('venues').select('venue_id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (firstVenue?.venue_id) {
      console.log('[DASH] no access to venue → redirect first')
      redirect(`${BASE}/dashboard/${firstVenue.venue_id}`)
    }
    redirect(`${BASE}/complete-profile`)
  }

  // Precompute lightweight stats server-side (active tables today)
  const start = new Date(); start.setHours(0,0,0,0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  const { data: activeRows } = await supabase
    .from('orders')
    .select('table_number, status, created_at')
    .eq('venue_id', params.venueId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
  const activeTables = new Set((activeRows ?? [])
    .filter(r => r && r.table_number != null && r.status !== 'served' && r.status !== 'paid')
    .map(r => r.table_number)).size

  return (
    <AsyncErrorBoundary
      onError={(err, info) => {
        console.error('[DASH] Error boundary:', err, info)
      }}
    >
      <DashboardClient 
        venueId={params.venueId}
        userId={user.id}
        activeTables={activeTables}
        venue={venue}
      />
    </AsyncErrorBoundary>
  )
}
