import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  console.log('[DASHBOARD DEBUG] Dashboard page loading...');
  
  // Check for auth cookies before making auth calls
  const hasAuthCookie = await hasServerAuthCookie();
  console.log('[DASHBOARD DEBUG] Has auth cookie:', hasAuthCookie);
  
  if (!hasAuthCookie) {
    console.log('[DASHBOARD DEBUG] No auth cookie, redirecting to sign-in');
    redirect('/sign-in');
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[DASHBOARD DEBUG] User:', user?.id, 'Error:', userError);
  
  if (userError) {
    console.log('[DASHBOARD DEBUG] User error, redirecting to sign-in');
    redirect('/sign-in');
  }
  
  if (!user) {
    console.log('[DASHBOARD DEBUG] No user, redirecting to sign-in');
    redirect('/sign-in');
  }

  // Get the user's primary venue
  const { data: venues, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  console.log('[DASHBOARD DEBUG] Venues:', venues, 'Error:', venueError);

  if (venueError) {
    console.log('[DASHBOARD DEBUG] Venue error, redirecting to complete-profile');
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    console.log('[DASHBOARD DEBUG] No venues found, checking OAuth user');
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
          console.log('[DASHBOARD DEBUG] Created venue, redirecting to:', `/dashboard/${venueId}`);
          redirect(`/dashboard/${venueId}`);
        }
      } else {
        // No venue data in metadata, redirect to complete profile
        redirect('/complete-profile');
      }
    }
  }

  const venueId = venues[0].venue_id;
  console.log('[DASHBOARD DEBUG] Found venue, redirecting to:', `/dashboard/${venueId}`);
  
  // Redirect to the primary venue's dashboard
  redirect(`/dashboard/${venueId}`);
}