// Simple script to run the SQL fix for dashboard counts
// This can be run with: node run-sql-fix.js

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQLFix() {
  console.log('Running SQL fix for dashboard counts...');
  
  try {
    // Test current function first
    console.log('Testing current dashboard_counts function...');
    const { data: testResult, error: testError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: 'venue-1e02af4d', 
        p_tz: 'Europe/London', 
        p_live_window_mins: 30 
      })
      .single();

    if (testError) {
      console.error('Error testing current function:', testError);
      return;
    }

    console.log('Current dashboard_counts result:', testResult);
    
    // The function exists and works, but we need to update it
    // Since we can't run DDL through RPC, we need to run this in the Supabase dashboard
    console.log('\n=== MANUAL STEP REQUIRED ===');
    console.log('Please run the following SQL in your Supabase dashboard:');
    console.log('\n' + '='.repeat(50));
    console.log(`
-- Fix dashboard_counts function to include UNPAID orders
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO anon;

-- Test the updated function
SELECT 'Testing updated function...' as info, * FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);
    `);
    console.log('='.repeat(50));
    console.log('\nAfter running the SQL above, the dashboard counts should show the correct numbers including UNPAID orders.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

runSQLFix();
