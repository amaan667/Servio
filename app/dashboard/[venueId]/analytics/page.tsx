export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import dynamicImport from 'next/dynamic';

// Lazy load the analytics component with charts
const AnalyticsClient = dynamicImport(() => import('./AnalyticsClient'), {
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Analytics</h2>
        <p className="text-gray-900">Preparing your analytics dashboard...</p>
      </div>
    </div>
  )
});

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      return null;
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    log('ANALYTICS SSR user', { hasUser: !!user, error: userError?.message });
    
    if (userError) {
      console.error('[ANALYTICS] Auth error:', userError);
      return null;
    }
    
    if (!user) {
      return null;
    }

    // Verify user owns this venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[ANALYTICS] Venue query error:', venueError);
      return null;
    }

    if (!venue) {
      return null;
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NavigationBreadcrumb venueId={venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Analytics for {venue.venue_name}
            </h1>
            <p className="text-lg text-foreground mt-2">
              View your business insights and performance metrics
            </p>
          </div>
          
          <AnalyticsClient venueId={venueId} venueName={venue.venue_name} />
        </div>
      </div>
    );
  } catch (error) {
    console.error('[ANALYTICS] Unexpected error:', error);
    return null;
  }
}
