export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import { EnhancedFeedbackSystem } from '@/components/enhanced-feedback-system';
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

export default async function FeedbackPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    log('FEEDBACK PAGE SSR user', { hasUser: !!user, error: userError?.message });
    
    if (userError) {
      console.error('Auth error:', userError);
      redirect('/sign-in');
    }
    
    if (!user) {
      redirect('/sign-in');
    }

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('Database error:', venueError);
      redirect('/?auth_error=database_error');
    }
    
    if (!venue) {
      // Check if user has any venues at all before redirecting to sign-in
      const { data: userVenues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .limit(1);

      if (!userVenues || userVenues.length === 0) {
        redirect('/complete-profile');
      }

      // User has venues but not this one, redirect to their first venue
      redirect(`/dashboard/${userVenues[0].venue_id}`);
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NavigationBreadcrumb venueId={venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Customer Feedback</h1>
            <p className="mt-2 text-gray-900">
              Monitor customer satisfaction and respond to feedback for {venue.name}
            </p>
          </div>
          
          <EnhancedFeedbackSystem venueId={venueId} />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Feedback page error:', error);
    redirect('/?auth_error=server_error');
  }
}


