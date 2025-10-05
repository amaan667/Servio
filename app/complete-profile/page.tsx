'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CompleteProfileForm from './form';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const checkUserAndVenues = async () => {
      try {
        const { data: { user }, error: userErr } = await createClient().auth.getUser();
        
        if (userErr || !user) {
          router.replace('/');
          return;
        }

        // Check if user is a Google OAuth user (new sign-up)
        const isOAuthUser = user.identities?.some((identity: any) => 
          identity.provider === 'google' || identity.provider === 'oauth'
        );

        // Only show complete profile form for new Google OAuth users
        if (!isOAuthUser) {
          // For email sign-up users, redirect to dashboard or sign-in
          router.replace('/dashboard');
          return;
        }

        const { data: venue, error: venueErr } = await createClient()
          .from('venues')
          .select('venue_id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (venueErr) {
          // Silent error handling
        }

        if (venue?.venue_id) {
          router.replace(`/dashboard/${venue.venue_id}`);
          return;
        }

        // Only show form for Google OAuth users without venues
        setUser(user);
        setShowForm(true);
        setLoading(false);
      } catch (error) {
        router.replace('/');
      }
    };

    checkUserAndVenues();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-900">Loading...</p>
        </div>
      </div>
    );
  }

  if (showForm && user) {
    return <CompleteProfileForm user={user} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-900">Redirecting...</p>
      </div>
    </div>
  );
}
