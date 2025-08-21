export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export default async function DashboardPage() {
  console.log('[DASHBOARD] Main dashboard page loading');
  
  try {
    // [AUTH] Use proper server Supabase client with cookie handling
    const supabase = createServerSupabaseClient();
    console.log('[DASHBOARD] Supabase client created with proper cookies');

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[DASHBOARD] Auth getUser result:', { 
      hasUser: !!user, 
      userId: user?.id, 
      userError: userError?.message 
    });
    
    if (!user) {
      console.log('[DASHBOARD] No user found, redirecting to sign-in');
      redirect('/sign-in');
    }

    console.log('[DASHBOARD] Getting primary venue for user:', user.id);
    
    // Get the user's first venue directly
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (venueError) {
      console.error('[DASHBOARD] Error fetching venues:', venueError);
      redirect('/complete-profile');
    }
    
    if (venues && venues.length > 0) {
      const primaryVenueId = venues[0].venue_id;
      console.log('[DASHBOARD] Redirecting to primary venue:', primaryVenueId);
      redirect(`/dashboard/${primaryVenueId}`);
    } else {
      console.log('[DASHBOARD] No primary venue found, redirecting to complete profile');
      redirect('/complete-profile');
    }
  } catch (error) {
    console.error('[DASHBOARD] Error in dashboard page:', error);
    redirect('/sign-in');
  }
}