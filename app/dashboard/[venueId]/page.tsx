'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardClient from './page.client';

const supabase = createClient();

export default function VenuePage({ params, searchParams }: { params: { venueId: string }, searchParams: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [venueData, setVenueData] = useState<any>(null);

  useEffect(() => {
    const checkVenueAccess = async () => {
      try {
        console.log('[VENUE PAGE] Checking venue access for:', params.venueId);
        
        const { data: { user }, error: userError } = await createClient().auth.getUser();
        console.log('[DASHBOARD VENUE] Auth getUser result:', { 
          hasUser: !!user, 
          userId: user?.id, 
          userError: userError?.message 
        });
        
        if (!user) {
          console.log('[DASHBOARD VENUE] No user found, redirecting to sign-in');
          router.replace('/sign-in');
          return;
        }

        console.log('[DASHBOARD VENUE] Querying venue:', params.venueId);
        const { data: venue, error: vErr } = await supabase
          .from('venues').select('*').eq('venue_id', params.venueId).eq('owner_id', user.id).maybeSingle();

        console.log('[DASHBOARD VENUE] Venue query result:', { 
          hasVenue: !!venue, 
          venueId: venue?.venue_id,
          venueName: venue?.name,
          error: vErr?.message,
          userId: user.id,
          requestedVenueId: params.venueId
        });

        if (vErr) {
          console.error('[DASHBOARD VENUE] Database error:', vErr);
          router.replace('/sign-in?error=database_error');
          return;
        }
        
        if (!venue) {
          console.log('[DASHBOARD VENUE] Venue not found - user may not have access or venue does not exist');
          // Check if user has any venues at all before redirecting to sign-in
          const { data: userVenues } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', user.id)
            .limit(1);
          
          if (userVenues && userVenues.length > 0) {
            // User has venues but not this specific one - redirect to their first venue
            console.log('[DASHBOARD VENUE] User has other venues, redirecting to first venue');
            router.replace(`/dashboard/${userVenues[0].venue_id}`);
            return;
          } else {
            // User has no venues - redirect to complete profile
            console.log('[DASHBOARD VENUE] User has no venues, redirecting to complete profile');
            router.replace('/complete-profile');
            return;
          }
        }

        // Get timezone-aware today window (default to Europe/London until migration is run)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Compute unique active tables today (open tickets): status != 'served' and != 'paid' AND created today
        const { data: activeRows } = await supabase
          .from('orders')
          .select('table_number, status, payment_status, created_at')
          .eq('venue_id', params.venueId)
          .not('status', 'in', '(served,paid)')
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString());
        const uniqueActiveTables = new Set((activeRows ?? []).map((r: any) => r.table_number).filter((t: any) => t != null)).size;

        console.log('[DASHBOARD VENUE] Active tables:', { 
          venueId: params.venueId, 
          activeTables: uniqueActiveTables 
        });

        setVenueData({
          venueId: params.venueId,
          userId: user.id,
          activeTables: uniqueActiveTables,
          venue: venue
        });
        setLoading(false);
      } catch (error) {
        console.error('[DASHBOARD VENUE] Error in venue page:', error);
        router.replace('/sign-in');
      }
    };

    checkVenueAccess();
  }, [params.venueId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading venue...</p>
        </div>
      </div>
    );
  }

  if (!venueData) {
    return null;
  }

  return (
    <DashboardClient 
      venueId={venueData.venueId} 
      userId={venueData.userId}
      activeTables={venueData.activeTables}
      venue={venueData.venue}
    />
  );
}
