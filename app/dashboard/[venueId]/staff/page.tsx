// app/dashboard/[venueId]/staff/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import StaffClient from './staff-client';

export default async function StaffPage({ params }: { params: { venueId: string } }) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  // Require auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Confirm venue ownership
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name, owner_id')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) return notFound();

  // Load staff (SSR fetch; RLS ensures only owner sees their staff)
  const { data: staff = [] } = await supabase
    .from('staff')
    .select('id, name, role, active, created_at')
    .eq('venue_id', params.venueId)
    .order('created_at', { ascending: true });

  return (
    <StaffClient
      venueId={params.venueId}
      venueName={venue.name}
      initialStaff={staff as any}
    />
  );
}


