
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import QRCodeClientWrapper from './QRCodeClientWrapper';
import PageHeader from '@/components/PageHeader';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';

export default async function QrCodesPage({ params }: { params: { venueId: string }}) {
  const venueId = params.venueId;
  
  // Get venue information
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/sign-in');

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={`QR Codes for ${venue.name}`}
          description="Generate and manage QR codes for your venue"
          venueId={venueId}
        />
        
        <GlobalErrorBoundary>
          <ErrorBoundary>
            <QRCodeClientWrapper venueId={venueId} venueName={venue.name} />
          </ErrorBoundary>
        </GlobalErrorBoundary>
      </div>
    </div>
  );
}