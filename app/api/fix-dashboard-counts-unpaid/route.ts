import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return undefined; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );

    // Drop and recreate the dashboard_counts function to include UNPAID orders
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);'
    });

    if (dropError) {
      console.error('Error dropping function:', dropError);
    }

    // Create the updated function
    const createFunctionSQL = `
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
            AND payment_status IN ('PAID', 'UNPAID', 'TILL');
          
          -- Count earlier today orders (today but before live window) - include both PAID and UNPAID
          SELECT COUNT(*) INTO earlier_today_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at < live_cutoff
            AND created_at >= today_start
            AND created_at <= today_end
            AND payment_status IN ('PAID', 'UNPAID', 'TILL');
          
          -- Count history orders (before today) - include both PAID and UNPAID
          SELECT COUNT(*) INTO history_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at < today_start
            AND payment_status IN ('PAID', 'UNPAID', 'TILL');
          
          -- Count total today's orders - include both PAID and UNPAID
          SELECT COUNT(*) INTO today_orders_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at >= today_start
            AND created_at <= today_end
            AND payment_status IN ('PAID', 'UNPAID', 'TILL');
          
          -- Count active tables (tables with current orders) - include both PAID and UNPAID
          SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at >= today_start
            AND created_at <= today_end
            AND payment_status IN ('PAID', 'UNPAID', 'TILL')
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
    `;

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: createFunctionSQL
    });

    if (createError) {
      console.error('Error creating function:', createError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create function: ' + createError.message 
      }, { status: 500 });
    }

    // Test the updated function
    const { data: testResult, error: testError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: 'venue-1e02af4d', 
        p_tz: 'Europe/London', 
        p_live_window_mins: 30 
      })
      .single();

    if (testError) {
      console.error('Error testing function:', testError);
      return NextResponse.json({ 
        success: false, 
        error: 'Function created but test failed: ' + testError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Dashboard counts function updated to include UNPAID orders',
      testResult
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
