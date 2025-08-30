export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getUserSafe } from '../../../../utils/getUserSafe'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'

export default async function VenueSettings({ params }: { params: { venueId: string } }) {
  const user = await getUserSafe('app/dashboard/[venueId]/settings/page.tsx')
  if (!user) {
    redirect('/sign-in')
  }

  const supabase = await createClient()
  const { data: venue, error } = await supabase
    .from('venues')
    .select('id, name, slug, owner_id')
    .eq('slug', params.venueId)
    .single()

  if (error) {
    console.error('Failed to load venue', error)
    return <div>Error loading venue</div>
  }

  return <div>Settings for {venue.name}</div>
}
