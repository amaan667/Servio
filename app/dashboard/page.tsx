'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

export default function DashboardIndex() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        console.log('[DASHBOARD] Starting user session check');
        setIsProcessing(true);
        
        // Check Supabase configuration first
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.error('[DASHBOARD] Missing Supabase environment variables');
          router.replace('/sign-in?error=configuration');
          return;
        }
        
        console.log('[DASHBOARD] Getting user session');
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
        // Don't redirect immediately on error, let the user see the error
        setIsProcessing(false);
      }
    };

    checkUserAndRedirect();
  }, [router]);

  // Show loading state while processing to prevent error page flash
  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Only show error state if we're not processing and something went wrong
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-4">Unable to load your dashboard. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}