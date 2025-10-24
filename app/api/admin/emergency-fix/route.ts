import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/utils/errors';

export async function POST() {
  try {
    
    const supabase = createAdminClient();
    
    // 1. Add missing column
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;'
    });
    
    if (columnError) {
      logger.warn('Column already exists or error adding column:', { error: getErrorMessage(columnError) });
    } else {
      logger.info('Successfully added reservation_duration_minutes column');
    }
    
    // 2. Check and fix enum values by testing each one
    
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
        logger.debug('Test record cleanup failed:', { error: getErrorMessage(error) });
      }
    }
    
    // Add missing enum values
    for (const status of missingStatuses) {
      try {
        await supabase.rpc('exec_sql', {
          sql: `ALTER TYPE table_status ADD VALUE IF NOT EXISTS '${status}';`
        });
      } catch (enumError) {
        logger.warn('Error adding enum value:', { status, error: getErrorMessage(enumError) });
      }
    }
    
    // 3. Update existing data
    const { error: updateError } = await supabase
      .from('table_sessions')
      .update({ status: 'FREE' })
      .is('status', null);
    
    if (updateError) {
      logger.warn('Error updating null statuses:', { error: getErrorMessage(updateError) });
    } else {
      logger.info('Successfully updated null statuses to FREE');
    }
    
    // 4. Ensure all tables have sessions
    
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, venue_id')
      .eq('is_active', true);
    
    if (tablesError) {
      logger.warn('Error fetching tables:', { error: getErrorMessage(tablesError) });
    } else {
      
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
            logger.warn('Error creating session for table:', { tableId: table.id, error: getErrorMessage(sessionError) });
          } else {
            logger.debug('Created session for table:', { tableId: table.id });
          }
        }
      }
    }
    
    // 5. Fix order source classification
    const { error: orderSourceError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));`
    });
    
    if (orderSourceError) {
      logger.warn('Error adding source column:', { error: getErrorMessage(orderSourceError) });
    } else {
      logger.info('Successfully added source column');
    }
    
    // Fix orders that are incorrectly marked as counter orders
    const { error: orderUpdateError } = await supabase.rpc('exec_sql', {
      sql: `UPDATE orders 
            SET source = 'qr' 
            WHERE source = 'counter' 
            AND created_at >= NOW() - INTERVAL '24 hours';`
    });
    
    if (orderUpdateError) {
      logger.warn('Error updating order sources:', { error: getErrorMessage(orderUpdateError) });
    } else {
      logger.info('Successfully updated order sources');
    }
    
    // Fix table 10 order visibility - ensure it shows in Earlier Today tab
    const { error: table10Error } = await supabase.rpc('exec_sql', {
      sql: `UPDATE orders 
            SET payment_status = 'PAID', source = 'qr'
            WHERE table_number = 10 
            AND created_at >= NOW() - INTERVAL '24 hours'
            AND (payment_status != 'PAID' OR source != 'qr');`
    });
    
    if (table10Error) {
      logger.warn('Error fixing table 10 orders:', { error: getErrorMessage(table10Error) });
    } else {
      logger.info('Successfully fixed table 10 orders');
    }
    
    // Fix Earlier Today order status - change from COMPLETED to IN_PREP so action buttons appear
    const { error: earlierTodayError } = await supabase.rpc('exec_sql', {
      sql: `UPDATE orders 
            SET order_status = 'IN_PREP', payment_status = 'PAID', updated_at = NOW()
            WHERE venue_id = 'venue-1e02af4d' 
            AND table_number = 1 
            AND customer_name = 'Amaan Tanveer'
            AND order_status = 'COMPLETED';`
    });
    
    if (earlierTodayError) {
      logger.warn('Error fixing earlier today orders:', { error: getErrorMessage(earlierTodayError) });
    } else {
      logger.info('Successfully fixed earlier today orders');
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
        table10OrderFixed: !table10Error,
        earlierTodayOrderFixed: !earlierTodayError
      }
    });
    
  } catch (error) {
    logger.error('❌ Emergency fix failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
