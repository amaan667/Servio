import VenueSettingsClient from './VenueSettingsClient';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function VenueSettings({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user || !user.email) {
    redirect('/sign-in');
  }

  // Fetch venue data
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('*')
    .eq('venue_id', venueId)
    .single();

  if (venueError || !venue) {
    redirect('/dashboard');
  }

  // Fetch all venues for the user
  const { data: venues } = await supabase
    .from('venues')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch organization data
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, subscription_tier, is_grandfathered, stripe_customer_id, subscription_status, trial_ends_at')
    .eq('id', venue.organization_id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Venue Settings
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage your venue settings and preferences
          </p>
        </div>
        
        <VenueSettingsClient 
          user={user as any} 
          venue={venue} 
          venues={venues || []} 
          organization={organization || undefined}
        />
      </div>
    </div>
  );
}