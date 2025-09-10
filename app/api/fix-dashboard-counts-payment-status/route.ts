import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Read the SQL file content
    const sqlContent = `
-- Fix the dashboard_counts function to include unpaid orders
-- The issue is that the function only counts PAID orders, but unpaid orders should also be counted

-- Drop and recreate the dashboard_counts function
DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

-- Create the corrected dashboard_counts function
CREATE OR REPLACE FUNCTION dashboard_counts(
    p_venue_id text,
    p_tz text DEFAULT 'Europe/London',
    p_live_window_mins integer DEFAULT 30
)
RETURNS TABLE(
    live_count integer,
    earlier_today_count integer,
    history_count integer,
    today_orders_count integer,
    active_tables_count integer,
    tables_set_up integer,
    tables_in_use integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    today_start timestamptz;
    today_end timestamptz;
    live_cutoff timestamptz;
    live_count_val integer;
    earlier_today_count_val integer;
    history_count_val integer;
    today_orders_count_val integer;
    active_tables_count_val integer;
    tables_set_up_val integer;
    tables_in_use_val integer;
BEGIN
    -- Calculate time windows based on timezone
    today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
    today_end := today_start + INTERVAL '1 day' - INTERVAL '1 second';
    live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
    
    -- Count live orders (today within live window) - include both PAID and UNPAID
    SELECT COUNT(*) INTO live_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'UNPAID');
    
    -- Count earlier today orders (today but before live window) - include both PAID and UNPAID
    SELECT COUNT(*) INTO earlier_today_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < live_cutoff
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'UNPAID');
    
    -- Count history orders (before today) - include both PAID and UNPAID
    SELECT COUNT(*) INTO history_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at < today_start
      AND payment_status IN ('PAID', 'UNPAID');
    
    -- Count total today's orders - include both PAID and UNPAID
    SELECT COUNT(*) INTO today_orders_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'UNPAID');
    
    -- Count active tables (tables with current orders) - include both PAID and UNPAID
    SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
    FROM orders 
    WHERE venue_id = p_venue_id
      AND created_at >= today_start
      AND created_at <= today_end
      AND payment_status IN ('PAID', 'UNPAID')
      AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING');
    
    -- Count tables set up (from table_runtime_state) - FREE tables
    SELECT COUNT(*) INTO tables_set_up_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id
      AND primary_status = 'FREE';
    
    -- Count tables in use (from table_runtime_state) - OCCUPIED tables
    SELECT COUNT(*) INTO tables_in_use_val
    FROM table_runtime_state 
    WHERE venue_id = p_venue_id
      AND primary_status = 'OCCUPIED';
    
    -- Return the results
    RETURN QUERY SELECT 
        live_count_val,
        earlier_today_count_val,
        history_count_val,
        today_orders_count_val,
        active_tables_count_val,
        tables_set_up_val,
        tables_in_use_val;
END;
$$;

-- Test the function
SELECT 
    'Testing corrected dashboard_counts function...' as info,
    *
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO anon;
`;

    console.log('[FIX DASHBOARD COUNTS] Executing SQL to fix payment status filtering...');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('[FIX DASHBOARD COUNTS] SQL execution error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log('[FIX DASHBOARD COUNTS] SQL executed successfully:', data);

    return NextResponse.json({ 
      ok: true, 
      message: 'Dashboard counts function updated to include unpaid orders',
      data 
    });

  } catch (error) {
    console.error('[FIX DASHBOARD COUNTS] Error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
