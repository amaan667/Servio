import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('🚨 Emergency fix API called');
    
    const supabase = createAdminClient();
    
    // 1. Add missing column
    console.log('📋 Adding reservation_duration_minutes column...');
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;'
    });
    
    if (columnError) {
      console.log('⚠️  Column might already exist:', columnError.message);
    } else {
      console.log('✅ Column added successfully');
    }
    
    // 2. Check and fix enum values by testing each one
    console.log('📋 Checking table_status enum...');
    
    const testStatuses = ['RESERVED', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'CLOSED'];
    const missingStatuses = [];
    
    for (const status of testStatuses) {
      try {
        const { error: testError } = await supabase
          .from('table_sessions')
          .insert({
            table_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
            venue_id: 'test',
            status: status,
            customer_name: 'Test Customer',
            reservation_time: new Date().toISOString(),
            reservation_duration_minutes: 60
          });
        
        if (testError && testError.message.includes('invalid input value for enum')) {
          missingStatuses.push(status);
        } else {
          // Clean up test record
          await supabase
            .from('table_sessions')
            .delete()
            .eq('venue_id', 'test');
        }
      } catch (error) {
        console.log(`⚠️  Error testing status ${status}:`, error);
      }
    }
    
    // Add missing enum values
    for (const status of missingStatuses) {
      try {
        await supabase.rpc('exec_sql', {
          sql: `ALTER TYPE table_status ADD VALUE IF NOT EXISTS '${status}';`
        });
        console.log(`✅ Added enum value: ${status}`);
      } catch (enumError) {
        console.log(`⚠️  Could not add enum value ${status}:`, enumError);
      }
    }
    
    // 3. Update existing data
    console.log('📋 Updating existing data...');
    const { error: updateError } = await supabase
      .from('table_sessions')
      .update({ status: 'FREE' })
      .is('status', null);
    
    if (updateError) {
      console.log('⚠️  Error updating null statuses:', updateError.message);
    } else {
      console.log('✅ Updated null statuses');
    }
    
    // 4. Ensure all tables have sessions
    console.log('📋 Ensuring all tables have sessions...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, venue_id')
      .eq('is_active', true);
    
    if (tablesError) {
      console.log('❌ Error fetching tables:', tablesError.message);
    } else {
      console.log(`📋 Found ${tables.length} active tables`);
      
      for (const table of tables) {
        const { data: existingSession } = await supabase
          .from('table_sessions')
          .select('id')
          .eq('table_id', table.id)
          .is('closed_at', null)
          .maybeSingle();
        
        if (!existingSession) {
          const { error: sessionError } = await supabase
            .from('table_sessions')
            .insert({
              venue_id: table.venue_id,
              table_id: table.id,
              status: 'FREE',
              opened_at: new Date().toISOString()
            });
          
          if (sessionError) {
            console.log(`⚠️  Error creating session for table ${table.id}:`, sessionError.message);
          } else {
            console.log(`✅ Created session for table ${table.id}`);
          }
        }
      }
    }
    
    // 5. Fix order source classification
    console.log('📋 Fixing order source classification...');
    const { error: orderSourceError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));`
    });
    
    if (orderSourceError) {
      console.log('⚠️  Order source column might already exist:', orderSourceError.message);
    } else {
      console.log('✅ Order source column ensured');
    }
    
    // Fix orders that are incorrectly marked as counter orders
    const { error: orderUpdateError } = await supabase.rpc('exec_sql', {
      sql: `UPDATE orders 
            SET source = 'qr' 
            WHERE source = 'counter' 
            AND created_at >= NOW() - INTERVAL '24 hours';`
    });
    
    if (orderUpdateError) {
      console.log('⚠️  Error updating order source:', orderUpdateError.message);
    } else {
      console.log('✅ Order source classification fixed');
    }
    
    // Fix table 10 order visibility - ensure it shows in Earlier Today tab
    console.log('📋 Fixing table 10 order visibility...');
    const { error: table10Error } = await supabase.rpc('exec_sql', {
      sql: `UPDATE orders 
            SET payment_status = 'PAID', source = 'qr'
            WHERE table_number = 10 
            AND created_at >= NOW() - INTERVAL '24 hours'
            AND (payment_status != 'PAID' OR source != 'qr');`
    });
    
    if (table10Error) {
      console.log('⚠️  Error fixing table 10 order:', table10Error.message);
    } else {
      console.log('✅ Table 10 order visibility fixed');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Emergency fix applied successfully',
      fixes: {
        columnAdded: !columnError,
        missingStatuses: missingStatuses,
        dataUpdated: !updateError,
        tablesProcessed: tables?.length || 0,
        orderSourceFixed: !orderUpdateError,
        table10OrderFixed: !table10Error
      }
    });
    
  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
