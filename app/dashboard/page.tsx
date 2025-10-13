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

  // Get the user's primary venue
  const { data: venues, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (venueError) {
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    // Check if user is a Google OAuth user
    const isOAuthUser = user.identities?.some((identity: any) => 
      identity.provider === 'google' || identity.provider === 'oauth'
    );

    if (isOAuthUser) {
      // Google OAuth users go to complete profile
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
            venue_name: venueName,
            business_type: businessType,
            owner_user_id: user.id,
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

  const venueId = venues[0].venue_id;
  
  // Redirect to the primary venue's dashboard
  redirect(`/dashboard/${venueId}`);
}