// app/dashboard/[venueId]/staff/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import StaffClient from './staff-client';

export default async function StaffPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[STAFF] Page mounted for venue', params.venueId);
  
  const supabase = createServerSupabase();

  const { data: { user } } = await createClient().auth.getUser();
  log('STAFF SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Staff Management for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Manage your team and staff permissions
          </p>
        </div>
        
        <StaffClient venueId={params.venueId} />
      </div>
    </div>
  );
}


