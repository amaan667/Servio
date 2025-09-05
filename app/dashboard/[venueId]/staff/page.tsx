// app/dashboard/[venueId]/staff/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import StaffClient from './staff-client';

export default async function StaffPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[STAFF] Page mounted for venue', params.venueId);
  
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      console.log('[STAFF] No auth cookie found, redirecting to sign-in');
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    log('STAFF SSR user', { hasUser: !!user, error: userError?.message });
    
    if (userError) {
      console.error('[STAFF] Auth error:', userError);
      redirect('/sign-in');
    }
    
    if (!user) {
      console.log('[STAFF] No user found, redirecting to sign-in');
      redirect('/sign-in');
    }

    // Verify user owns this venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', params.venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[STAFF] Venue query error:', venueError);
      redirect('/dashboard');
    }

    if (!venue) {
      console.log('[STAFF] Venue not found or user does not own it');
      redirect('/dashboard');
    }

    // Get initial staff data and counts server-side to prevent flickering
    const { data: initialStaff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('venue_id', params.venueId)
      .is('deleted_at', null)  // Only fetch non-deleted staff
      .order('created_at', { ascending: false });

    if (staffError) {
      console.error('[STAFF] Error fetching initial staff:', staffError);
    }

    // Get authoritative staff counts from the new RPC function
    const { data: initialCounts, error: countsError } = await supabase
      .rpc('staff_counts', { 
        p_venue_id: params.venueId
      })
      .single();

    if (countsError) {
      console.error('[STAFF] Error fetching staff counts:', countsError);
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NavigationBreadcrumb venueId={params.venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Staff Management for {venue.name}
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Add staff and manage roles
            </p>
          </div>
          
          <StaffClient 
            venueId={params.venueId} 
            venueName={venue.name}
            initialStaff={initialStaff || []}
            initialCounts={initialCounts}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('[STAFF] Unexpected error:', error);
    redirect('/sign-in');
  }
}


