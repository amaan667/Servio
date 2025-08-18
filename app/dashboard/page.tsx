export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export default async function DashboardVenue({
  params,
}: { params: { venueId?: string } }) {
  const venueId = params?.venueId;
  if (!venueId) return notFound();

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: venue } = await supabase
    .from('venues').select('venue_id, name').eq('venue_id', venueId).eq('owner_id', user.id).maybeSingle();

  if (!venue) return notFound();

  // Render your existing venue dashboard tiles/cards here
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold">Welcome back, Manager!</h1>
      <p className="text-muted-foreground mt-2">Here’s what’s happening at {venue.name} today.</p>
      {/* Links to Live Orders, Menu Management, QR Codes, Analytics, etc. */}
    </div>
  );
}