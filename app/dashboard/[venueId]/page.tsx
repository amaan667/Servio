'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import DashboardClient from './page.client';
import AsyncErrorBoundary from '@/components/AsyncErrorBoundary';

export default function VenuePage({ params, searchParams }: { params: { venueId: string }, searchParams: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [venueData, setVenueData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkVenueAccess = async () => {
      try {
        console.log('[VENUE PAGE] Checking venue access for:', params.venueId);
        setLoading(true);
        setError(null);
        
        // Check Supabase configuration first
        if (!isSupabaseConfigured()) {
          console.error('[DASHBOARD VENUE] Missing Supabase environment variables');
          setError('Database configuration is missing. Please check your environment setup.');
          setLoading(false);
          return;
        }

        if (!supabase) {
          console.error('[DASHBOARD VENUE] Supabase client is null');
          setError('Unable to connect to database');
          setLoading(false);
          return;
        }
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('[DASHBOARD VENUE] Auth getUser result:', { 
          hasUser: !!user, 
          userId: user?.id, 
          userError: userError?.message 
        });
        
        if (userError) {
          console.error('[DASHBOARD VENUE] Auth error:', userError);
          setError(`Authentication error: ${userError.message}`);
          setLoading(false);
          return;
        }
        
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
          setError(`Database error: ${vErr.message}`);
          setLoading(false);
          return;
        }
        
        if (!venue) {
          console.log('[DASHBOARD VENUE] Venue not found - user may not have access or venue does not exist');
          // Check if user has any venues at all before redirecting to sign-in
          const { data: userVenues, error: venuesError } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', user.id)
            .limit(1);
          
          if (venuesError) {
            console.error('[DASHBOARD VENUE] Error checking user venues:', venuesError);
            setError(`Error checking user venues: ${venuesError.message}`);
            setLoading(false);
            return;
          }
          
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

        // Get today's date window (simple date-based approach)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Compute unique active tables today (open tickets): status != 'served' and != 'paid' AND created today
        const { data: activeRows, error: activeError } = await supabase
          .from('orders')
          .select('table_number, status, payment_status, created_at')
          .eq('venue_id', params.venueId)
          .not('status', 'in', '(served,paid)')
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString());
          
        if (activeError) {
          console.error('[DASHBOARD VENUE] Error fetching active orders:', activeError);
          // Continue with 0 active tables instead of failing
        }
        
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
        setError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
      }
    };

    checkVenueAccess();
  }, [params.venueId, router]);

  // Always show loading state while checking access
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading venue dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state if something went wrong
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-servio-purple text-white px-4 py-2 rounded-md hover:bg-servio-purple/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Only render the client component if we have valid venue data
  if (!venueData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparing dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <AsyncErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[DASHBOARD] Error caught by boundary:', error, errorInfo);
      }}
    >
      <DashboardClient 
        venueId={venueData.venueId} 
        userId={venueData.userId}
        activeTables={venueData.activeTables}
        venue={venueData.venue}
      />
    </AsyncErrorBoundary>
  );
}
