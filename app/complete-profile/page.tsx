export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/server/supabase';
import CompleteProfileForm from './form';

export default async function CompleteProfilePage() {
  console.log('[COMPLETE-PROFILE] CompleteProfilePage function called');
  
  const supabase = createServerSupabaseClient();
  console.log('[COMPLETE-PROFILE] Supabase client created');

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  console.log('[COMPLETE-PROFILE] Auth getUser result:', { 
    hasUser: !!user, 
    userId: user?.id, 
    userError: userErr?.message 
  });
  
  if (userErr || !user) {
    console.log('[COMPLETE-PROFILE] No user found, redirecting to sign-in');
    redirect('/sign-in');
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
    redirect(`/dashboard/${venue.venue_id}`);
  }

  console.log('[COMPLETE-PROFILE] No venue found, showing complete profile form');
  return <CompleteProfileForm user={user} />;
}
