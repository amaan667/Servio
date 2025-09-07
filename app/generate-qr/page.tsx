export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import GenerateQRClient from './GenerateQRClient';

export default async function GenerateQRPage() {
  try {
    console.log('🔍 [QR PAGE] ===== STARTING QR PAGE LOAD =====');
    console.log('🔍 [QR PAGE] Timestamp:', new Date().toISOString());
    
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    console.log('🔍 [QR PAGE] Has auth cookie:', hasAuthCookie);
    if (!hasAuthCookie) {
      console.log('🔍 [QR PAGE] No auth cookie, redirecting to sign-in');
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();
    console.log('🔍 [QR PAGE] Supabase client created successfully');

    const { data: { user } } = await supabase.auth.getUser();
    console.log('🔍 [QR PAGE] User authentication result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email
    });
    if (!user) {
      console.log('🔍 [QR PAGE] No user found, redirecting to sign-in');
      redirect('/sign-in');
    }

    console.log('🔍 [QR PAGE] Fetching venue data for user:', user.id);
    const { data: venue, error } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();

    console.log('🔍 [QR PAGE] Venue query result:', {
      hasVenue: !!venue,
      venueId: venue?.venue_id,
      venueName: venue?.name,
      error: error?.message
    });

    // Get active tables count using the same logic as dashboard
    let activeTablesCount = 0;
    let activeTablesError = null;
    
    try {
      console.log('🔍 [QR PAGE] Getting active tables count...');
      
      // Use the same dashboard_counts function to get consistent counts
      const { data: countsData, error: countsError } = await supabase
        .rpc('dashboard_counts', {
          p_venue_id: venue.venue_id,
          p_tz: 'Europe/London', // Default timezone, could be made dynamic
          p_live_window_mins: 30
        })
        .single();
      
      if (countsError) {
        console.error('🔍 [QR PAGE] Dashboard counts error:', countsError);
        activeTablesError = countsError;
      } else {
        // Use tables_set_up to match the table management page
        console.log('🔍 [QR PAGE] Raw countsData:', countsData);
        console.log('🔍 [QR PAGE] tables_set_up value:', countsData?.tables_set_up);
        activeTablesCount = countsData?.tables_set_up || 0;
        console.log('🔍 [QR PAGE] Final activeTablesCount:', activeTablesCount);
      }
    } catch (queryError) {
      console.error('🔍 [QR PAGE] Active tables query failed:', queryError);
      activeTablesError = queryError;
    }
    
    if (error) {
      console.error('🔍 [QR PAGE] Database error:', error);
      redirect('/complete-profile');
    }
    
    if (!venue) {
      console.log('🔍 [QR PAGE] No venue found, redirecting to complete-profile');
      redirect('/complete-profile');
    }

    console.log('🔍 [QR PAGE] ===== RENDERING QR PAGE COMPONENT =====');
    console.log('🔍 [QR PAGE] Props being passed to GenerateQRClient:', {
      venueId: venue.venue_id,
      venueName: venue.name,
      activeTablesCount: activeTablesCount,
      activeTablesError: activeTablesError?.message
    });
    
    // Continue even if active tables query failed - we can still show QR codes
    if (activeTablesError) {
      console.log('🔍 [QR PAGE] Active tables query had error, but continuing with default count:', activeTablesError.message);
    }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <NavigationBreadcrumb venueId={venue.venue_id} />
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            QR Codes for {venue.name}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2">
            Generate and manage QR codes for your tables
          </p>
        </div>
        
        <GenerateQRClient 
          venueId={venue.venue_id} 
          venueName={venue.name} 
          activeTablesCount={activeTablesCount}
        />
      </div>
    </div>
  );
  } catch (error: any) {
    console.error('[QR PAGE] Error in GenerateQRPage:', error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading QR Code Page</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}