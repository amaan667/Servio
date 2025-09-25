// app/dashboard/[venueId]/staff/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase/server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import StaffClient from './staff-client';

export default async function StaffPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
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
      redirect('/sign-in');
    }

    // Verify user owns this venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[STAFF] Venue query error:', venueError);
      redirect('/dashboard');
    }

    if (!venue) {
      redirect('/dashboard');
    }

    // Get initial staff data and counts server-side to prevent flickering
    const admin = createAdminClient();
    const { data: initialStaff, error: staffError } = await admin
      .from('staff')
      .select('*')
      .eq('venue_id', venueId)
      .is('deleted_at', null)  // Only fetch non-deleted staff
      .order('created_at', { ascending: false });

    if (staffError) {
      console.error('[STAFF] Error fetching initial staff:', staffError);
    }

    // Calculate staff counts server-side
    const staffData = initialStaff || [];
    
    const totalStaff = staffData.length;
    const activeStaff = staffData.filter((s: any) => s.active === true).length;
    const uniqueRoles = new Set(staffData.map((s: any) => s.role)).size;
    
    
    // Get active shifts count
    const now = new Date();
    const { data: allShifts, error: shiftsError } = await admin
      .from('staff_shifts')
      .select('start_time, end_time')
      .eq('venue_id', venueId);
    
    if (shiftsError) {
      console.error('[STAFF] Error fetching shifts for counts:', shiftsError);
    }
    
    
    const activeShiftsCount = (allShifts || []).filter((shift: any) => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      return now >= start && now <= end;
    }).length;
    
    
    const initialCounts = {
      total_staff: totalStaff,
      active_staff: activeStaff,
      unique_roles: uniqueRoles,
      active_shifts_count: activeShiftsCount
    };
    

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NavigationBreadcrumb venueId={venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Staff Management for {venue.name}
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Add staff and manage roles
            </p>
          </div>
          
          <StaffClient 
            venueId={venueId} 
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


