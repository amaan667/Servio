export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import GenerateQRClientSimple from './GenerateQRClient.simple';

export default async function GenerateQRPage() {
  console.log('[QR PAGE] Starting GenerateQRPage');
  
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[QR PAGE] User auth result:', { hasUser: !!user });
  
  if (!user) {
    console.log('[QR PAGE] No user, redirecting to sign-in');
    redirect('/sign-in');
  }

  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_user_id', user.id)
    .limit(1)
    .single();

  console.log('[QR PAGE] Venue lookup result:', { hasVenue: !!venue, venueId: venue?.venue_id });

  if (!venue) {
    console.log('[QR PAGE] No venue, redirecting to complete-profile');
    redirect('/complete-profile');
  }

  // Get accurate table counts
  let activeTablesCount = 0;
  const { data: tableCounters } = await supabase
    .rpc('api_table_counters', {
      p_venue_id: venue.venue_id
    });
  
  if (tableCounters && tableCounters.length > 0) {
    activeTablesCount = tableCounters[0].total_tables || 0;
  }

  console.log('[QR PAGE] Final data:', { venueId: venue.venue_id, activeTablesCount });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venue.venue_id} />
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">
            QR Codes for {venue.name}
          </h1>
          <p className="text-base sm:text-lg text-black mt-2">
            Generate and manage QR codes for your tables
          </p>
        </div>
        
        <GenerateQRClientSimple 
          venueId={venue.venue_id} 
          venueName={venue.name} 
          activeTablesCount={activeTablesCount}
        />
      </div>
    </div>
  );
}