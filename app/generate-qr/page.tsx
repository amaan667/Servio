export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GenerateQRClient from './GenerateQRClient';

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

  // Get active tables count
  const { data: activeTablesData } = await supabase
    .from('tables')
    .select('id')
    .eq('venue_id', venue.venue_id)
    .eq('is_active', true);

  const activeTablesCount = activeTablesData?.length || 0;

  console.log('[QR PAGE] Rendering QR page for venue:', venue.name);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            QR Codes for {venue.name}
          </h1>
          <p className="text-lg mt-2">
            Generate and manage QR codes for your tables
          </p>
        </div>
        
        <GenerateQRClient 
          venueId={venue.venue_id}
          venueName={venue.name}
          activeTablesCount={activeTablesCount}
        />
      </div>
    </div>
  );
}