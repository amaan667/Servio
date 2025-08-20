export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import { createServerSupabaseClient } from '@/lib/server/supabase';
import { getPrimaryVenueId } from '@/lib/server/getPrimaryVenue';

export default async function DashboardPage() {
  console.log('[DASHBOARD] Main dashboard page loading');
  
  // [AUTH] Use proper server Supabase client with cookie handling
  const supabase = createServerSupabaseClient();
  console.log('[DASHBOARD] Supabase client created with proper cookies');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[DASHBOARD] Auth getUser result:', { 
    hasUser: !!user, 
    userId: user?.id, 
    userError: userError?.message 
  });
  
  log('DASH SSR user', { hasUser: !!user });
  if (!user) {
    console.log('[DASHBOARD] No user found, redirecting to sign-in');
    redirect('/sign-in');
  }

  console.log('[DASHBOARD] Getting primary venue for user:', user.id);
  const primaryVenueId = await getPrimaryVenueId();
  
  if (primaryVenueId) {
    console.log('[DASHBOARD] Redirecting to primary venue:', primaryVenueId);
    redirect(`/dashboard/${primaryVenueId}`);
  } else {
    console.log('[DASHBOARD] No primary venue found, redirecting to complete profile');
    redirect('/complete-profile');
  }
}