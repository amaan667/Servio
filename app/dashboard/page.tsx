export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';

export default async function DashboardIndex() {
  console.log('[DASHBOARD] DashboardIndex function called');
  
  const jar = await cookies();
  console.log('[DASHBOARD] Cookies jar created');
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  console.log('[DASHBOARD] Supabase client created');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[DASHBOARD] Auth getUser result:', { 
    hasUser: !!user, 
    userId: user?.id, 
    userError: userError?.message 
  });
  
  log('DASHBOARD INDEX user', { hasUser: !!user, userId: user?.id });
  if (!user) {
    console.log('[DASHBOARD] No user found, redirecting to sign-in');
    redirect('/sign-in');
  }

  console.log('[DASHBOARD] Querying venues for user:', user.id);
  const { data: venues, error } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  console.log('[DASHBOARD] Venues query result:', { 
    venuesCount: venues?.length, 
    venues: venues,
    error: error?.message,
    errorCode: error?.code 
  });

  log('DASHBOARD INDEX venues', { venuesCount: venues?.length, error: error?.message });

  if (error) {
    console.error('[DASHBOARD] venues error:', error);
    console.log('[DASHBOARD] Redirecting to complete-profile due to error');
    redirect('/complete-profile?error=venues');
  }
  if (!venues?.length) {
    console.log('[DASHBOARD] No venues found, redirecting to complete-profile');
    redirect('/complete-profile');
  }

  const venueId = venues[0].venue_id;
  console.log('[DASHBOARD] Found venue, redirecting to:', venueId);
  log('DASHBOARD INDEX redirecting', { venueId });
  redirect(`/dashboard/${venueId}`);
}
