export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function GenerateQRPage() {
  console.log('[QR PAGE] Starting GenerateQRPage');
  
  try {
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
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Tables</h2>
            <p className="text-gray-600">
              Venue ID: {venue.venue_id}
            </p>
            <p className="text-gray-600 mt-2">
              This page is working! The client component will be added next.
            </p>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[QR PAGE] Error:', error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading QR Code Page</h2>
          <p className="text-gray-600 mb-4">{String(error)}</p>
          <a 
            href="/generate-qr"
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Retry
          </a>
        </div>
      </div>
    );
  }
}