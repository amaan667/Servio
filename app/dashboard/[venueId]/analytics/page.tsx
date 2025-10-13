import AnalyticsClientSimple from './AnalyticsClient.simple';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/sign-in');
  }

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .single();

  if (venueError || !venue) {
    redirect('/complete-profile');
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Analytics Dashboard
          </h1>
          <p className="text-lg text-foreground mt-2">
            View your business insights and performance metrics
          </p>
        </div>
        
        <AnalyticsClientSimple venueId={venueId} venueName={venue.venue_name || "Your Venue"} />
      </div>
    </div>
  );
}