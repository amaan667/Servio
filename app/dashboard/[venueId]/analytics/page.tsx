export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import AnalyticsClient from './AnalyticsClient';
import PageHeader from '@/components/PageHeader';

export default async function AnalyticsPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[ANALYTICS] Page mounted for venue', params.venueId);
  
  const supabase = createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  log('ANALYTICS SSR user', { hasUser: !!user });
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={`Analytics for ${venue.name}`}
          description="View insights and performance metrics"
          venueId={params.venueId}
        />
        
        <AnalyticsClient venueId={params.venueId} />
      </div>
    </div>
  );
}
