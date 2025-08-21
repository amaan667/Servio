export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import ClientNavBar from '@/components/ClientNavBar';
import QRCodeClient from '../qr-codes/QRCodeClient';

export default async function QRPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[QR] Page mounted for venue', params.venueId);
  
  const supabase = createServerSupabase();

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            QR Codes for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Generate and manage QR codes for your tables
          </p>
        </div>
        
        <QRCodeClient venueId={params.venueId} />
      </div>
    </div>
  );
}
