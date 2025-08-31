export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import QuestionsClient from './QuestionsClient';

export default async function FeedbackPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[FEEDBACK] Page mounted for venue', params.venueId);
  
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      console.log('[FEEDBACK] No auth cookie found, redirecting to sign-in');
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    log('FEEDBACK SSR user', { hasUser: !!user, error: userError?.message });
    
    if (userError) {
      console.error('[FEEDBACK] Auth error:', userError);
      redirect('/sign-in');
    }
    
    if (!user) {
      console.log('[FEEDBACK] No user found, redirecting to sign-in');
      redirect('/sign-in');
    }

    // Verify user owns this venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name, timezone')
      .eq('venue_id', params.venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[FEEDBACK] Venue query error:', venueError);
      redirect('/dashboard');
    }

    if (!venue) {
      console.log('[FEEDBACK] Venue not found or user does not own it');
      redirect('/dashboard');
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NavigationBreadcrumb venueId={params.venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Feedback for {venue.name}
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              See customer reviews and ratings
            </p>
          </div>
          
          <QuestionsClient venueId={params.venueId} venueName={venue.name} />
        </div>
      </div>
    );
  } catch (error) {
    console.error('[FEEDBACK] Unexpected error:', error);
    redirect('/sign-in');
  }
}


