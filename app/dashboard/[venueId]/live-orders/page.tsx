export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@/lib/sb-client';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import LiveOrdersClient from './LiveOrdersClient';

export default async function LiveOrdersPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[LIVE-ORDERS] Page mounted for venue', params.venueId);
  
  const supabase = await createServerSupabase();

  const { data: { user } } = await createClient().auth.getUser();
  log('LIVE-ORDERS SSR user', { hasUser: !!user });
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={params.venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Live Orders for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Monitor and manage real-time orders
          </p>
        </div>
        
        <LiveOrdersClient venueId={params.venueId} />
      </div>
    </div>
  );
}