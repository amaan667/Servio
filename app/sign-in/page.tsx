export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';
import SignInForm from './signin-form';

function SignInPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      // If we just signed out BUT already have a session (e.g., auth cookies restored), still route

      // If already signed in, route based on venues
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // show form

      const { data: venue } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', session.user.id)
        .maybeSingle();

      if (venue?.venue_id) router.replace(`/dashboard/${venue.venue_id}`);
      else router.replace('/complete-profile');
    };
    run();
  }, [router, sp]);

  return <SignInForm />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  );
}
