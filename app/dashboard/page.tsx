'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/sb-client';

export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        console.log('[DASHBOARD] Checking user session');
        
        const { data: { session }, error: sessionError } = await createClient().auth.getSession();
        console.log('[DASHBOARD] Auth getSession result:', { 
          hasSession: !!session, 
          userId: session?.user?.id, 
          sessionError: sessionError?.message 
        });
        
        if (!session || !session.user) {
          console.log('[DASHBOARD] No session found, redirecting to sign-in');
          router.replace('/sign-in');
          return;
        }
        
        const user = session.user;

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
          router.replace('/complete-profile');
          return;
        }
        
        if (venues && venues.length > 0) {
          const primaryVenueId = venues[0].venue_id;
          console.log('[DASHBOARD] Redirecting to primary venue:', primaryVenueId);
          router.replace(`/dashboard/${primaryVenueId}`);
        } else {
          console.log('[DASHBOARD] No primary venue found, redirecting to complete profile');
          router.replace('/complete-profile');
        }
      } catch (error) {
        console.error('[DASHBOARD] Error in dashboard page:', error);
        router.replace('/sign-in');
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