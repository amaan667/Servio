import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('🔧 Applying database fix...');
    
    const supabase = createAdminClient();
    
    // 1. Add missing column
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
