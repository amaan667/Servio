'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CompleteProfileForm from './form';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserAndVenues = async () => {
      try {
        console.log('[COMPLETE-PROFILE] Checking user session');
        
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
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
        const { data: venue, error: venueErr } = await supabase
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
        setUser(user);
        setLoading(false);
      } catch (error) {
        console.error('[COMPLETE-PROFILE] Error:', error);
        router.replace('/sign-in');
      }
    };

    checkUserAndVenues();
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

  if (!user) {
    return null;
  }

  return <CompleteProfileForm user={user} />;
}
