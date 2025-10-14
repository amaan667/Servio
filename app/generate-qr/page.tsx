import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GenerateQRClient from './GenerateQRClient';

export default async function GenerateQRPage() {
  const { user } = await getAuthenticatedUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const supabase = await createClient();
  
  // Get user's venues
  const { data: venues, error: venuesError } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });

  if (venuesError || !venues || venues.length === 0) {
    redirect('/onboarding');
  }

  // For now, use the first venue (in the future, this could be venue selection)
  const venue = venues[0];

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading QR Generator</h2>
          <p className="text-gray-700">Setting up QR code generation...</p>
        </div>
      </div>
    }>
      <GenerateQRClient 
        venueId={venue.venue_id} 
        venueName={venue.name}
      />
    </Suspense>
  );
}
