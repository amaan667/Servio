export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import LiveOrdersClient from './LiveOrdersClient';
import PageHeader from '@/components/PageHeader';
import ErrorBoundary from '@/components/ErrorBoundary';

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
      throw new Error('Supabase configuration is missing');
    }

    const supabase = createServerSupabase();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[LIVE-ORDERS] Auth error:', authError);
      throw new Error(`Authentication error: ${authError.message}`);
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
      throw new Error(`Database error: ${venueError.message}`);
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
          
          <ErrorBoundary>
            <LiveOrdersClient venueId={params.venueId} />
          </ErrorBoundary>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[LIVE-ORDERS] Server-side error:', error);
    
    // Return an error page instead of throwing
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-servio-purple text-white px-4 py-2 rounded-md hover:bg-servio-purple/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
}