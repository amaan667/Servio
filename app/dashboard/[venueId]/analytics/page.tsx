export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import AnalyticsClient from './AnalyticsClient';

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
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Analytics for {venue.name}
          </h1>
          <p className="text-sm sm:text-lg text-muted-foreground mt-2">
            View insights and performance metrics
          </p>
        </div>
        
        <AnalyticsClient venueId={params.venueId} />
      </div>
    </div>
  );
}
