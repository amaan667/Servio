import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Update the dashboard_counts function to include UNPAID orders
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop the function if it exists (to recreate it)
        DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

        -- Create the updated dashboard_counts function
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
              AND created_at <= today_end;
            
            -- Count earlier today orders (today but before live window) - include both PAID and UNPAID
            SELECT COUNT(*) INTO earlier_today_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at < live_cutoff
              AND created_at >= today_start
              AND created_at <= today_end;
            
            -- Count history orders (before today) - include both PAID and UNPAID
            SELECT COUNT(*) INTO history_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at < today_start;
            
            -- Count total today's orders - include both PAID and UNPAID
            SELECT COUNT(*) INTO today_orders_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at >= today_start
              AND created_at <= today_end;
            
            -- Count active tables (tables with current orders) - include both PAID and UNPAID
            SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at >= today_start
              AND created_at <= today_end
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

        -- Grant execute permission to authenticated users
        GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO authenticated;
        GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO anon;
      `
    });

    if (error) {
      console.error('Error updating dashboard_counts function:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Dashboard counts function updated to include UNPAID orders' 
    });

  } catch (error: any) {
    console.error('Error in fix-dashboard-counts-unpaid:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}