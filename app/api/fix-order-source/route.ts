import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    console.log('[FIX ORDER SOURCE] Starting order source fix...');
    
    // Step 1: Ensure source column exists
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));`
    });
    
    if (alterError) {
      console.log('[FIX ORDER SOURCE] Alter table result:', alterError.message);
    } else {
      console.log('[FIX ORDER SOURCE] ✓ Source column ensured');
    }

    // Step 2: Fix orders that should be table orders but are marked as counter orders
    const { data: updateData, error: updateError } = await supabase
      .from('orders')
      .update({ source: 'qr' })
      .eq('source', 'counter')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (updateError) {
      console.error('[FIX ORDER SOURCE] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 });
    } else {
      console.log(`[FIX ORDER SOURCE] ✓ Updated ${updateData?.length || 0} orders`);
    }

    // Step 3: Verify the fix
    const { data: verifyData, error: verifyError } = await supabase
      .from('orders')
      .select('id, table_number, source, customer_name, created_at')
      .eq('table_number', 10)
      .order('created_at', { ascending: false })
      .limit(5);

    if (verifyError) {
      console.error('[FIX ORDER SOURCE] Verify error:', verifyError);
      return NextResponse.json({ error: 'Failed to verify orders' }, { status: 500 });
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

    console.log('[FIX ORDER SOURCE] ✅ Order source fix completed successfully!');
    console.log('[FIX ORDER SOURCE] Results:', results);

    return NextResponse.json({ 
      success: true, 
      message: 'Order source classification fixed successfully',
      results 
    });

  } catch (error) {
    console.error('[FIX ORDER SOURCE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
