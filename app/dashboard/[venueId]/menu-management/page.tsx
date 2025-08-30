export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getUserSafe } from '../../../../utils/getUserSafe'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'

export default async function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const user = await getUserSafe('app/dashboard/[venueId]/menu-management/page.tsx')
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

  return <div>Menu Management for {venue.name}</div>
}