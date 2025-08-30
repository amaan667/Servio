export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  // Check for auth cookies before making auth calls
  const hasAuthCookie = await hasServerAuthCookie();
  if (!hasAuthCookie) {
    console.log('[SETTINGS] No auth cookie found, redirecting to sign-in');
    redirect('/sign-in');
  }

  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[SETTINGS] No user found, redirecting to sign-in');
    redirect('/sign-in');
  }

  console.log('[SETTINGS] User authenticated, fetching venues for user:', user.id);

  // Get the user's venues
  const { data: venues, error } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[SETTINGS] Error fetching venues:', error);
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    console.log('[SETTINGS] No venues found, redirecting to complete profile');
    redirect('/complete-profile');
  }

  // If user has multiple venues, redirect to the primary venue's settings
  if (venues.length > 1) {
    console.log('[SETTINGS] Multiple venues found, redirecting to primary venue settings');
    redirect(`/dashboard/${venues[0].venue_id}/settings`);
  }

  // If user has exactly one venue, show the settings page
  console.log('[SETTINGS] Rendering settings page for venue:', venues[0].venue_id);
  
  return (
    <SettingsClient 
      user={{ id: user.id, email: user.email || undefined }} 
      venues={venues} 
    />
  );
}
