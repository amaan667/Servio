import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('🔧 Applying database fix...');
    
    const supabase = createAdminClient();
    
    // 1. Fix dashboard counts to include UNPAID orders
    console.log('Fixing dashboard counts to include UNPAID orders...');
    const { error: dashboardError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop the existing function
        DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

        -- Create updated dashboard_counts function that includes UNPAID orders for today's count
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
            -- Calculate time windows more explicitly
            today_start := date_trunc('day', NOW() AT TIME ZONE p_tz) AT TIME ZONE p_tz;
            today_end := today_start + INTERVAL '1 day';
            live_cutoff := NOW() - (p_live_window_mins || ' minutes')::interval;
            
            -- Count live orders (today within live window) - only PAID orders for live
            SELECT COUNT(*) INTO live_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at >= live_cutoff
              AND created_at >= today_start
              AND created_at < today_end
              AND payment_status = 'PAID';
            
            -- Count earlier today orders (today but before live window) - only PAID orders
            SELECT COUNT(*) INTO earlier_today_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at < live_cutoff
              AND created_at >= today_start
              AND created_at < today_end
              AND payment_status = 'PAID';
            
            -- Count history orders (before today) - only PAID orders
            SELECT COUNT(*) INTO history_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at < today_start
              AND payment_status = 'PAID';
            
            -- Count total today's orders (ALL orders from today, including UNPAID)
            SELECT COUNT(*) INTO today_orders_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at >= today_start
              AND created_at < today_end;
              -- Removed payment_status filter to include UNPAID orders
            
            -- Count active tables (tables with current orders) - only PAID orders
            SELECT COUNT(DISTINCT table_number) INTO active_tables_count_val
            FROM orders 
            WHERE venue_id = p_venue_id
              AND created_at >= today_start
              AND created_at < today_end
              AND payment_status = 'PAID'
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

        -- Grant permissions
        GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO authenticated;
        GRANT EXECUTE ON FUNCTION dashboard_counts(text, text, integer) TO anon;
      `
    });
    
    if (dashboardError) {
      console.error('Dashboard fix error:', dashboardError);
    } else {
      console.log('✅ Dashboard counts fixed to include UNPAID orders');
    }
    
    // 2. Apply aggressive table reset for new day
    console.log('Applying aggressive table reset for new day...');
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(process.cwd(), 'reset-all-tables-new-day.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    const { error: tableResetError } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    });
    
    if (tableResetError) {
      console.error('Table reset error:', tableResetError);
    } else {
      console.log('✅ All tables reset for new day (counts should be 0)');
    }
    
    // 3. Add missing column
    console.log('Adding reservation_duration_minutes column...');
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;'
    });
    
    // 2. Add missing enum values
    console.log('Adding missing enum values...');
    const enumValues = ['RESERVED', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'CLOSED'];
    
    for (const value of enumValues) {
      try {
        await supabase.rpc('exec_sql', {
          sql: `ALTER TYPE table_status ADD VALUE IF NOT EXISTS '${value}';`
        });
        console.log(`Added enum value: ${value}`);
      } catch (error) {
        console.log(`Enum value ${value} might already exist`);
      }
    }
    
    // 3. Update existing data
    console.log('Updating existing data...');
    await supabase
      .from('table_sessions')
      .update({ status: 'FREE' })
      .is('status', null);
    
    // 4. Ensure all tables have sessions
    console.log('Ensuring all tables have sessions...');
    const { data: tables } = await supabase
      .from('tables')
      .select('id, venue_id')
      .eq('is_active', true);
    
    if (tables) {
      for (const table of tables) {
        const { data: existingSession } = await supabase
          .from('table_sessions')
          .select('id')
          .eq('table_id', table.id)
          .is('closed_at', null)
          .maybeSingle();
        
        if (!existingSession) {
          await supabase
            .from('table_sessions')
            .insert({
              venue_id: table.venue_id,
              table_id: table.id,
              status: 'FREE',
              opened_at: new Date().toISOString()
            });
        }
      }
    }
    
    // 5. Recreate the view
    console.log('Recreating view...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP VIEW IF EXISTS tables_with_sessions;
        CREATE VIEW tables_with_sessions AS
        SELECT 
          t.id, t.venue_id, t.label, t.seat_count, t.is_active, t.qr_version,
          t.created_at as table_created_at,
          ts.id as session_id, ts.status, ts.order_id, ts.opened_at, ts.closed_at,
          ts.customer_name, ts.reservation_time, ts.reservation_duration_minutes,
          o.total_amount, o.customer_name as order_customer_name, o.order_status,
          o.payment_status, o.updated_at as order_updated_at
        FROM tables t
        LEFT JOIN table_sessions ts ON t.id = ts.table_id 
          AND ts.id = (SELECT id FROM table_sessions ts2 WHERE ts2.table_id = t.id ORDER BY ts2.opened_at DESC LIMIT 1)
        LEFT JOIN orders o ON ts.order_id = o.id
        WHERE t.is_active = true;
        GRANT SELECT ON tables_with_sessions TO authenticated;
      `
    });
    
    console.log('✅ Database fix completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Database fix applied successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
