import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

export async function POST() {
  try {
    // Create admin client to bypass RLS
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

    console.log('[FIX TABLE ASSIGNMENTS] Starting to fix table assignments...');

    const venueId = 'venue-1e02af4d';
    const results: any = {
      venue_id: venueId,
      fixes_applied: []
    };

    // Fix 1: Update Hamza's £133.50 order from table 1 to table 9
    console.log('[FIX TABLE ASSIGNMENTS] Looking for Hamza £133.50 order...');
    const { data: hamzaOrders, error: hamzaError } = await supabase
      .from('orders')
      .select('id, table_number, customer_name, total_amount, created_at')
      .eq('venue_id', venueId)
      .eq('total_amount', 13350) // £133.50 in pence
      .order('created_at', { ascending: false })
      .limit(5);

    if (!hamzaError && hamzaOrders && hamzaOrders.length > 0) {
      for (const order of hamzaOrders) {
        if (order.customer_name?.toLowerCase().includes('hamza') && order.table_number === 1) {
          console.log('[FIX TABLE ASSIGNMENTS] Updating Hamza order from table 1 to table 9...');
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              table_number: 9,
              source: 'qr' // Ensure it's marked as QR order for Table 9
            })
            .eq('id', order.id);

          if (!updateError) {
            results.fixes_applied.push({
              type: 'hamza_table_fix',
              order_id: order.id,
              customer: order.customer_name,
              amount: '£133.50',
              changed_from: 'Table 1',
              changed_to: 'Table 9',
              success: true
            });
            console.log('[FIX TABLE ASSIGNMENTS] Successfully updated Hamza order to Table 9');
          } else {
            results.fixes_applied.push({
              type: 'hamza_table_fix',
              order_id: order.id,
              success: false,
              error: updateError.message
            });
            console.error('[FIX TABLE ASSIGNMENTS] Error updating Hamza order:', updateError);
          }
        }
      }
    }

    // Fix 2: Ensure Donald's £47.70 order is correctly marked as counter order
    console.log('[FIX TABLE ASSIGNMENTS] Looking for Donald £47.70 order...');
    const { data: donaldOrders, error: donaldError } = await supabase
      .from('orders')
      .select('id, table_number, customer_name, total_amount, source, items, created_at')
      .eq('venue_id', venueId)
      .eq('total_amount', 4770) // £47.70 in pence
      .order('created_at', { ascending: false })
      .limit(5);

    if (!donaldError && donaldOrders && donaldOrders.length > 0) {
      for (const order of donaldOrders) {
        if (order.customer_name?.toLowerCase().includes('donald') && order.table_number === 9) {
          console.log('[FIX TABLE ASSIGNMENTS] Ensuring Donald order is marked as counter...');
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              source: 'counter' // Ensure it's marked as counter order
            })
            .eq('id', order.id);

          if (!updateError) {
            results.fixes_applied.push({
              type: 'donald_source_fix',
              order_id: order.id,
              customer: order.customer_name,
              amount: '£47.70',
              table_number: 9,
              changed_to: 'Counter 9',
              success: true
            });
            console.log('[FIX TABLE ASSIGNMENTS] Successfully marked Donald order as counter');
          } else {
            results.fixes_applied.push({
              type: 'donald_source_fix',
              order_id: order.id,
              success: false,
              error: updateError.message
            });
            console.error('[FIX TABLE ASSIGNMENTS] Error updating Donald order:', updateError);
          }
        }
      }
    }

    // Verify the changes
    console.log('[FIX TABLE ASSIGNMENTS] Verifying changes...');
    const { data: verifyOrders, error: verifyError } = await supabase
      .from('orders')
      .select('id, table_number, customer_name, total_amount, source, created_at')
      .eq('venue_id', venueId)
      .in('total_amount', [13350, 4770])
      .order('created_at', { ascending: false });

    results.verification = {
      success: !verifyError,
      error: verifyError?.message,
      orders: verifyOrders || []
    };

    console.log('[FIX TABLE ASSIGNMENTS] Table assignment fixes completed');
    return NextResponse.json({
      success: true,
      message: 'Table assignments fixed successfully',
      results
    });

  } catch (error) {
    console.error('[FIX TABLE ASSIGNMENTS] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}