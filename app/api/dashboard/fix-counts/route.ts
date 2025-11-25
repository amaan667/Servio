import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * API route to fix the dashboard_counts function
 * This ensures today_orders_count = live_count + earlier_today_count
 */
export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    const createFunctionSQL = `
      DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

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
          
          -- Count live orders (today within live window) - include PAID, PAY_LATER, and TILL
          SELECT COUNT(*) INTO live_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at >= live_cutoff
            AND created_at >= today_start
            AND created_at <= today_end
            AND payment_status IN ('PAID', 'PAY_LATER', 'TILL');
          
          -- Count earlier today orders (today but before live window) - include PAID, PAY_LATER, and TILL
          SELECT COUNT(*) INTO earlier_today_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at < live_cutoff
            AND created_at >= today_start
            AND created_at <= today_end
            AND payment_status IN ('PAID', 'PAY_LATER', 'TILL');
          
          -- Count history orders (before today) - include PAID, PAY_LATER, and TILL
          SELECT COUNT(*) INTO history_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at < today_start
            AND payment_status IN ('PAID', 'PAY_LATER', 'TILL');
          
          -- Count total today's orders = live + earlier today (for consistency)
          -- This ensures today_orders_count always equals live_count + earlier_today_count
          today_orders_count_val := live_count_val + earlier_today_count_val;
          
          -- Count active tables (tables with current orders) - include PAID, PAY_LATER, and TILL
          SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
          FROM orders 
          WHERE venue_id = p_venue_id
            AND created_at >= today_start
            AND created_at <= today_end
            AND payment_status IN ('PAID', 'PAY_LATER', 'TILL')
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

    const { error } = await supabase.rpc("exec_sql", { sql: createFunctionSQL });

    if (error) {
      // Try direct execution
      const { error: execError } = await supabase.from("_exec").select("*").limit(0);

      return NextResponse.json(
        {
          success: false,
          error: "Please run the SQL migration manually in Supabase SQL Editor",
          sql: createFunctionSQL,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "dashboard_counts function updated" });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Please update the database function manually. The SQL is in the API route file.",
      },
      { status: 500 }
    );
  }
}
