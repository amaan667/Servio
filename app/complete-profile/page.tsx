'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const checkUserAndVenues = async () => {
      try {
        console.log('[COMPLETE-PROFILE] Checking user session');
        
        // Dynamically import to avoid build-time issues
        const { createClient } = await import('@/lib/sb-client');
        
        const { data: { user }, error: userErr } = await createClient().auth.getUser();
        console.log('[COMPLETE-PROFILE] Auth getUser result:', { 
          hasUser: !!user, 
          userId: user?.id, 
          userError: userErr?.message 
        });
        
        if (userErr || !user) {
          console.log('[COMPLETE-PROFILE] No user found, redirecting to sign-in');
          router.replace('/sign-in');
          return;
        }

        console.log('[COMPLETE-PROFILE] Querying venues for user:', user.id);
        const { data: venue, error: venueErr } = await createClient()
          .from('venues')
          .select('venue_id')
          .eq('owner_id', user.id)
          .maybeSingle();

        console.log('[COMPLETE-PROFILE] Venues query result:', { 
          hasVenue: !!venue, 
          venueId: venue?.venue_id,
          error: venueErr?.message 
        });

        if (venueErr) {
          console.error('Error checking existing venue:', venueErr);
        }

        if (venue?.venue_id) {
          console.log('[COMPLETE-PROFILE] Found existing venue, redirecting to dashboard');
          router.replace(`/dashboard/${venue.venue_id}`);
          return;
        }

        console.log('[COMPLETE-PROFILE] No venue found, showing complete profile form');
        // Dynamically import the form component
        const { default: CompleteProfileForm } = await import('./form');
        setLoading(false);
        
        // Render the form component
        const formElement = document.createElement('div');
        formElement.id = 'complete-profile-form';
        document.body.appendChild(formElement);
        
        // This is a temporary workaround - in a real app, you'd use React rendering
        window.location.href = '/sign-in?message=Please complete your profile';
      } catch (error) {
        console.error('[COMPLETE-PROFILE] Error:', error);
        router.replace('/sign-in');
      }
    };

    // Add a small delay to ensure we're fully on the client side
    setTimeout(() => {
      checkUserAndVenues();
    }, 100);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to sign-in...</p>
      </div>
    </div>
  );
}
