import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { BASE } from '@/lib/env';
import DashboardClient from './page.client';
import AsyncErrorBoundary from '@/components/AsyncErrorBoundary';

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  if (!params?.venueId) {
    console.error('[DASH] No venueId provided');
    redirect('/sign-in');
  }

  const supabase = createServerSupabase();

  try {
    console.log('[DASH] Checking auth for venue:', params.venueId);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('[DASH] auth error on venue page:', authError.message);
      redirect('/sign-in');
    }
    if (!user) {
      console.log('[DASH] no session → /sign-in');
      redirect('/sign-in');
    }

    console.log('[DASH] User authenticated:', user.id);

    const { data: venue, error: venueErr } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', params.venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueErr) {
      console.error('[DASH] venue query error:', venueErr.message);
      redirect('/sign-in');
    }

    if (!venue) {
      console.log('[DASH] Venue not found, checking user venues');
      const { data: userVenues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (userVenues && userVenues.length > 0) {
        console.log('[DASH] Redirecting to first venue:', userVenues[0].venue_id);
        redirect(`/dashboard/${userVenues[0].venue_id}`);
      } else {
        console.log('[DASH] No venues found, redirecting to complete profile');
        redirect('/complete-profile');
      }
    }

    console.log('[DASH] Venue found:', venue.name);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: activeRows } = await supabase
      .from('orders')
      .select('table_number, status, payment_status, created_at')
      .eq('venue_id', params.venueId)
      .not('status', 'in', '(served,paid)')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    const uniqueActiveTables = new Set(
      (activeRows ?? [])
        .map((r: any) => r.table_number)
        .filter((t: any) => t != null)
    ).size;

    console.log('[DASH] session → /dashboard/:venueId', { venueId: params.venueId, activeTables: uniqueActiveTables });

    return (
      <AsyncErrorBoundary
        onError={(error, errorInfo) => {
          console.error('[DASH] boundary error:', error, errorInfo);
        }}
      >
        <DashboardClient
          venueId={params.venueId}
          userId={user.id}
          activeTables={uniqueActiveTables}
          venue={venue}
        />
      </AsyncErrorBoundary>
    );
  } catch (e) {
    console.error('[DASH] unexpected error on venue page:', e);
    redirect('/sign-in');
  }
}
