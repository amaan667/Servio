export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import dynamicImport from 'next/dynamic';

import AnalyticsClientSimple from './AnalyticsClient.simple';

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
      console.log('[ANALYTICS] No auth cookie found, redirecting to home');
      redirect('/');
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    log('ANALYTICS SSR user', { hasUser: !!user, error: userError?.message });
    
    if (userError) {
      console.error('[ANALYTICS] Auth error:', userError);
      redirect('/');
    }
    
    if (!user) {
      console.log('[ANALYTICS] No user found, redirecting to home');
      redirect('/');
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
          
          <AnalyticsClientSimple venueId={venueId} venueName={venue.venue_name} />
        </div>
      </div>
    );
  } catch (error: any) {
    if (error?.message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error('[ANALYTICS] Unexpected error:', error);
    redirect('/');
  }
}
