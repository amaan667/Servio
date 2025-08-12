export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import VenueDashboardClient from './page.client';

export default async function VenueDashboardPage({ params }: { params: { venueId: string } }) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Optional: verify access to this venue id belongs to user; if not, redirect to their first venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, owner_id')
    .eq('venue_id', params.venueId)
    .single();

  if (!venue || venue.owner_id !== user.id) {
    const { data: venues } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .limit(1);
    if (venues && venues.length > 0) redirect(`/dashboard/${venues[0].venue_id}`);
    redirect('/complete-profile');
  }

  return <VenueDashboardClient venueId={params.venueId} />;
}
