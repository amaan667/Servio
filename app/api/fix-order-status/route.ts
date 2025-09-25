import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check current order status
    const { data: currentOrder, error: checkError } = await supabase
      .from('orders')
      .select('id, order_status, payment_status, table_number, customer_name, created_at')
      .eq('venue_id', 'venue-1e02af4d')
      .eq('table_number', 1)
      .eq('customer_name', 'Amaan Tanveer')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (checkError) {
      console.error('Error checking order:', checkError)
      return NextResponse.json({ error: 'Failed to check order status' }, { status: 500 })
    }


    // Update the order to a proper workflow status so action buttons appear
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        order_status: 'IN_PREP',
        payment_status: 'PAID',
        updated_at: new Date().toISOString()
      })
      .eq('id', currentOrder.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating order:', updateError)
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
    }


    return NextResponse.json({ 
      success: true, 
      message: 'Order status updated successfully',
      order: updatedOrder
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
