export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import CompleteProfileForm from './form';

export default async function CompleteProfilePage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name, options) =>
          cookieStore.set({ name, value: '', ...options }),
      },
    }
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    console.error('getUser error in complete-profile', userErr);
    redirect('/sign-in');
  }
  if (!user) redirect('/sign-in');

  // Check if user metadata shows profileComplete === false
  const profileComplete = user.user_metadata?.profileComplete;
  if (profileComplete !== false) {
    // User has completed profile or metadata doesn't indicate incomplete profile
    // Check if user already has a venue
    const { data: venue, error: venueErr } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueErr) {
      console.error('Error checking existing venue:', venueErr);
      // Continue to show the form instead of failing completely
    } else if (venue?.venue_id) {
      redirect(`/dashboard/${venue.venue_id}`);
    }
  }

  // Only show complete profile if:
  // 1. User exists AND
  // 2. User metadata shows profileComplete === false
  if (profileComplete !== false) {
    // Redirect to dashboard if profile is complete
    redirect('/dashboard');
  }

  return <CompleteProfileForm user={user} />;
}
