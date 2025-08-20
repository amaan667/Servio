export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import ClientNavBar from "@/components/ClientNavBar";
import { createServerSupabaseClient } from '@/lib/server/supabase';

export default async function QRCodePage({ params }: { params: { venueId: string } }) {
  console.log('[QR] Page mounted for venue', params.venueId);
  
  // [AUTH] Use proper server Supabase client with cookie handling
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  log('QR SSR user', { hasUser: !!user });
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
      <ClientNavBar venueId={params.venueId} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">QR Codes</h1>
            <p className="text-gray-600 mt-2">Generate QR codes for {venue.name}</p>
          </div>
        </div>
        
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">QR Code Management</h2>
          <p className="text-gray-600 mb-6">Generate and manage QR codes for your venue tables.</p>
          <a 
            href={`/generate-qr?venue=${params.venueId}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Generate QR Codes
          </a>
        </div>
      </div>
    </div>
  );
}
