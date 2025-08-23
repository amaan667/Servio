'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        console.log('[DASHBOARD] Checking user session');
        
        // Check Supabase configuration first
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.error('[DASHBOARD] Missing Supabase environment variables');
          router.replace('/sign-in?error=configuration');
          return;
        }
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('[DASHBOARD] Auth getUser result:', { 
          hasUser: !!user, 
          userId: user?.id, 
          userError: userError?.message 
        });
        
        if (userError) {
          console.error('[DASHBOARD] Auth error:', userError);
          router.replace('/sign-in?error=auth');
          return;
        }
        
        if (!user) {
          console.log('[DASHBOARD] No user found, redirecting to sign-in');
          router.replace('/sign-in');
          return;
        }

        console.log('[DASHBOARD] Getting primary venue for user:', user.id);
        
        // Get the user's first venue directly with proper error handling
        const { data: venues, error: venueError } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);
        
        if (venueError) {
          console.error('[DASHBOARD] Error fetching venues:', venueError);
          router.replace('/complete-profile?error=database');
          return;
        }
        
        if (!venues || venues.length === 0) {
          console.log('[DASHBOARD] No venues found, redirecting to complete profile');
          router.replace('/complete-profile');
          return;
        }
        
        const primaryVenueId = venues[0].venue_id;
        console.log('[DASHBOARD] Redirecting to primary venue:', primaryVenueId);
        router.replace(`/dashboard/${primaryVenueId}`);
      } catch (error) {
        console.error('[DASHBOARD] Unexpected error in dashboard page:', error);
        router.replace('/sign-in?error=unexpected');
      }
    };

    checkUserAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );
}