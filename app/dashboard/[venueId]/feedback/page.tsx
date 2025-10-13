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
    const supabase = await createServerSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    log('FEEDBACK PAGE SSR user', { hasUser: !!user });
    
    if (!user) return null;

    const { data: venue } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    
    if (!venue) {
      const { data: userVenues } = await supabase
        .from('venues')
        .select('venue_id, created_at')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: true });

      if (userVenues && userVenues.length > 0) {
        // Redirect to main venue (first one created)
        redirect(`/dashboard/${userVenues[0].venue_id}`);
      }
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NavigationBreadcrumb venueId={venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Customer Feedback</h1>
            <p className="mt-2 text-gray-900">
              Monitor customer satisfaction and respond to feedback for {venue.venue_name}
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


