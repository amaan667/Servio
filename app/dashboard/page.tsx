import { redirect } from 'next/navigation'
import { getSupabaseServerReadOnly } from '@/lib/supabase-server'

export default async function DashboardIndex() {
  const supabase = getSupabaseServerReadOnly()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!venues || venues.length === 0) {
    redirect('/complete-profile')
  }

  const venueId = venues[0].venue_id as string
  redirect(`/dashboard/${venueId}`)
}