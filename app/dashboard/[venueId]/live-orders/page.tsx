export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import LiveOrdersClient from './LiveOrdersClient';
import PageHeader from '@/components/PageHeader';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';

export default async function LiveOrdersPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[LIVE-ORDERS] Page mounted for venue', params.venueId);
  
  try {
    // Check if environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[LIVE-ORDERS] Missing Supabase environment variables');
      // Return a client-side component that will handle the missing config
      return (
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PageHeader
              title="Live Orders"
              description="Monitor and manage real-time orders"
              venueId={params.venueId}
            />
            <GlobalErrorBoundary>
              <LiveOrdersClient venueId={params.venueId} />
            </GlobalErrorBoundary>
          </div>
        </div>
      );
    }

    const supabase = createServerSupabase();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[LIVE-ORDERS] Auth error:', authError);
      // Don't throw, let the client handle it
      return (
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PageHeader
              title="Live Orders"
              description="Monitor and manage real-time orders"
              venueId={params.venueId}
            />
            <GlobalErrorBoundary>
              <LiveOrdersClient venueId={params.venueId} />
            </GlobalErrorBoundary>
          </div>
        </div>
      );
    }
    
    log('LIVE-ORDERS SSR user', { hasUser: !!user });
    if (!user) redirect('/sign-in');

    // Verify user owns this venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', params.venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[LIVE-ORDERS] Venue query error:', venueError);
      // Don't throw, let the client handle it
      return (
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PageHeader
              title="Live Orders"
              description="Monitor and manage real-time orders"
              venueId={params.venueId}
            />
            <GlobalErrorBoundary>
              <LiveOrdersClient venueId={params.venueId} />
            </GlobalErrorBoundary>
          </div>
        </div>
      );
    }

    if (!venue) {
      console.log('[LIVE-ORDERS] User does not own venue, redirecting to dashboard');
      redirect('/dashboard');
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader
            title={`Live Orders for ${venue.name}`}
            description="Monitor and manage real-time orders"
            venueId={params.venueId}
          />
          
          <GlobalErrorBoundary>
            <ErrorBoundary>
              <LiveOrdersClient venueId={params.venueId} venueName={venue.name} />
            </ErrorBoundary>
          </GlobalErrorBoundary>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[LIVE-ORDERS] Server-side error:', error);
    
    // Return a client-side component that will handle errors gracefully
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader
            title="Live Orders"
            description="Monitor and manage real-time orders"
            venueId={params.venueId}
          />
          <GlobalErrorBoundary>
            <LiveOrdersClient venueId={params.venueId} />
          </GlobalErrorBoundary>
        </div>
      </div>
    );
  }
}