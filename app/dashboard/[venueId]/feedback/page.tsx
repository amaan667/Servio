import SimpleFeedbackClient from './SimpleFeedbackClient';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function FeedbackPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/sign-in');
  }

  // Fetch venue data to verify ownership
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('*')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (venueError) {
    console.error('Database error:', venueError);
    redirect('/?auth_error=database_error');
  }
  
  if (!venue) {
    // Check if user has any venues at all before redirecting
    const { data: userVenues } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_user_id', user.id)
      .limit(1);

    if (!userVenues || userVenues.length === 0) {
      redirect('/complete-profile');
    }

    // User has venues but not this one, redirect to their first venue
    redirect(`/dashboard/${userVenues[0].venue_id}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Customer Feedback
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage customer feedback and reviews for {venue.venue_name}
          </p>
        </div>
        
        <SimpleFeedbackClient venueId={venueId} />
      </div>
    </div>
  );
}