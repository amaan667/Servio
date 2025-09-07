import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[TABLE MAINTENANCE] Starting table maintenance...');
    
    // Check authentication
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      console.log('[TABLE MAINTENANCE] Authentication failed:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use admin client for maintenance operations
    const supabase = createAdminClient();

    // Run the table maintenance function
    const { data, error } = await supabase.rpc('run_table_maintenance');

    if (error) {
      console.error('[TABLE MAINTENANCE] Error running maintenance:', error);
      return NextResponse.json({ error: 'Failed to run table maintenance' }, { status: 500 });
    }

    console.log('[TABLE MAINTENANCE] Table maintenance completed successfully');
    return NextResponse.json({ 
      success: true, 
      message: 'Table maintenance completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[TABLE MAINTENANCE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log('[TABLE MAINTENANCE] Checking table maintenance status...');
    
    // Check authentication
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      console.log('[TABLE MAINTENANCE] Authentication failed:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use admin client for maintenance operations
    const supabase = createAdminClient();

    // Check for expired reservations
    const { data: expiredReservations, error: expiredError } = await supabase
      .from('table_sessions')
      .select('id, table_id, customer_name, reservation_time, reservation_duration_minutes')
      .eq('status', 'RESERVED')
      .not('reservation_time', 'is', null)
      .not('reservation_duration_minutes', 'is', null);

    if (expiredError) {
      console.error('[TABLE MAINTENANCE] Error checking expired reservations:', expiredError);
      return NextResponse.json({ error: 'Failed to check expired reservations' }, { status: 500 });
    }

    // Calculate which reservations are expired
    const now = new Date();
    const expired = expiredReservations?.filter(reservation => {
      if (!reservation.reservation_time || !reservation.reservation_duration_minutes) return false;
      const endTime = new Date(new Date(reservation.reservation_time).getTime() + reservation.reservation_duration_minutes * 60 * 1000);
      return now > endTime;
    }) || [];

    return NextResponse.json({
      success: true,
      expiredReservations: expired.length,
      totalReservations: expiredReservations?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[TABLE MAINTENANCE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
