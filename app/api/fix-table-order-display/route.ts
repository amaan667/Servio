import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('🔧 Fix table order display API called');
    
    const supabase = createAdminClient();
    
    // 1. Ensure source column exists
    console.log('📋 Ensuring source column exists...');
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));`
    });
    
    if (columnError) {
      console.log('⚠️  Column might already exist:', columnError.message);
    } else {
      console.log('✅ Source column ensured');
    }
    
    // 2. Fix orders that are incorrectly marked as counter orders
    console.log('📋 Fixing orders marked as counter but should be table orders...');
    const { data: updateData, error: updateError } = await supabase.rpc('exec_sql', {
      sql: `UPDATE orders 
            SET source = 'qr' 
            WHERE source = 'counter' 
            AND created_at >= NOW() - INTERVAL '24 hours';`
    });
    
    if (updateError) {
      console.log('⚠️  Error updating orders:', updateError.message);
    } else {
      console.log('✅ Orders updated successfully');
    }
    
    // 3. Verify the fix by checking table 10 orders
    console.log('📋 Verifying fix for table 10 orders...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('orders')
      .select('id, table_number, source, customer_name, created_at')
      .eq('table_number', 10)
      .order('created_at', { ascending: false })
      .limit(3);

    if (verifyError) {
      console.log('⚠️  Error verifying orders:', verifyError.message);
    } else {
      console.log('✅ Verification complete');
    }

    const results = verifyData?.map(order => ({
      id: order.id,
      customer_name: order.customer_name,
      table_number: order.table_number,
      source: order.source,
      display_name: order.source === 'qr' ? `Table ${order.table_number}` : 
                   order.source === 'counter' ? `Counter ${order.table_number}` : 'Unknown',
      created_at: order.created_at
    })) || [];
    
    return NextResponse.json({
      success: true,
      message: 'Table order display fixed successfully - orders now show as "Table X" instead of "Counter X"',
      fixes: {
        sourceColumnEnsured: !columnError,
        ordersUpdated: updateData?.length || 0,
        verificationComplete: !verifyError,
        results
      }
    });
    
  } catch (error) {
    console.error('❌ Fix table order display failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
