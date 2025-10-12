import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  // Check for auth cookies before making auth calls
  const hasAuthCookie = await hasServerAuthCookie();
  
  if (!hasAuthCookie) {
    redirect('/sign-in');
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    redirect('/sign-in');
  }
  
  if (!user) {
    redirect('/sign-in');
  }

  // Get the user's venues via RBAC
  const { data: userVenues, error: venueError } = await supabase
    .from('user_venue_roles')
    .select('venue_id')
    .eq('user_id', user.id)
    .limit(1);

  if (venueError) {
    console.error('Error fetching user venues from RBAC:', venueError);
  }

  // If no venues found in RBAC, check venues table directly
  if (!userVenues || userVenues.length === 0) {
    console.log('No venues found in RBAC for user:', user.id);
    
    // Check venues table directly (user might be owner)
    const { data: ownedVenues, error: ownedVenueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .limit(1);

    if (ownedVenueError) {
      console.error('Error fetching owned venues:', ownedVenueError);
    }

    // If user has a venue in venues table, redirect there
    if (ownedVenues && ownedVenues.length > 0) {
      const venueId = ownedVenues[0].venue_id;
      console.log('Found owned venue, redirecting to:', venueId);
      redirect(`/dashboard/${venueId}`);
    }

    // Only redirect to complete-profile if user truly has no venues
    console.log('No venues found in venues table either');
    // Check if user is a Google OAuth user
    const isOAuthUser = user.identities?.some((identity: any) => 
      identity.provider === 'google' || identity.provider === 'oauth'
    );

    if (isOAuthUser) {
      // Only new Google OAuth users without any venues go to complete profile
      redirect('/complete-profile');
    } else {
      // Email sign-up users should have venue data in metadata
      const venueName = user.user_metadata?.venue_name;
      const businessType = user.user_metadata?.business_type || 'Restaurant';
      
      if (venueName) {
        // Create venue for email sign-up user
        const venueId = `venue-${user.id.slice(0, 8)}`;
        const { error: createError } = await supabase
          .from('venues')
          .insert({
            venue_id: venueId,
            name: venueName,
            business_type: businessType,
            owner_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (createError) {
          console.error('Error creating venue for email user:', createError);
          redirect('/complete-profile');
        } else {
          redirect(`/dashboard/${venueId}`);
        }
      } else {
        // No venue data in metadata, redirect to complete profile
        redirect('/complete-profile');
      }
    }
  }

  const venueId = userVenues[0].venue_id;
  console.log('Redirecting to venue:', venueId);
  
  // Redirect to the primary venue's dashboard
  redirect(`/dashboard/${venueId}`);
}