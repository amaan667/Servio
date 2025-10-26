import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Order } from "../types";
import { TERMINAL_STATUSES } from "../constants";

export async function updateOrderStatus(
  orderId: string,
  orderStatus: Order['order_status'],
  venueId: string,
  todayWindow: { startUtcISO: string; endUtcISO: string } | null,
  onUpdate: (orderId: string, status: Order['order_status']) => void,
  onMoveToAllToday: (orderId: string, status: Order['order_status']) => void,
  onRemove: (orderId: string) => void
) {
  const supabase = createClient();
  
  const { data: orderData } = await supabase
    .from('orders')
    .select('id, table_id, table_number, source, created_at')
    .eq('id', orderId)
    .eq('venue_id', venueId)
    .single();

  const { error } = await supabase
    .from('orders')
    .update({ 
      order_status: orderStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .eq('venue_id', venueId);

  if (!error) {
    if (TERMINAL_STATUSES.includes(orderStatus)) {
      onRemove(orderId);
      
      if (orderData && orderData.created_at) {
        const orderCreatedAt = new Date(orderData.created_at);
        if (todayWindow && orderCreatedAt >= new Date(todayWindow.startUtcISO) && orderCreatedAt < new Date(todayWindow.endUtcISO)) {
          onMoveToAllToday(orderId, orderStatus);
        }
      }
    } else {
      onUpdate(orderId, orderStatus);
    }
    
    // Handle table cleanup for QR orders
    if ((orderStatus === 'COMPLETED' || orderStatus === 'CANCELLED') && orderData && (orderData.table_id || orderData.table_number) && orderData.source === 'qr') {
      await clearTableSession(orderData, venueId, orderId);
    }
  }
}

async function clearTableSession(orderData: unknown, venueId: string, orderId: string) {
  try {
    const supabase = createClient();
    
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, order_status, table_id, table_number')
      .eq('venue_id', venueId)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING'])
      .neq('id', orderId);

    let filteredActiveOrders = activeOrders || [];
    if (orderData.table_id) {
      filteredActiveOrders = (activeOrders || []).filter((o: Record<string, unknown>) => o.table_id === orderData.table_id);
    } else if (orderData.table_number) {
      filteredActiveOrders = (activeOrders || []).filter((o: Record<string, unknown>) => o.table_number === orderData.table_number);
    }

    if (!filteredActiveOrders || filteredActiveOrders.length === 0) {
      const sessionUpdateData = {
        status: 'FREE',
        order_id: null,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let sessionQuery = supabase
        .from('table_sessions')
        .update(sessionUpdateData)
        .eq('venue_id', venueId)
        .is('closed_at', null);

      if (orderData.table_id) {
        sessionQuery = sessionQuery.eq('table_id', orderData.table_id);
      } else if (orderData.table_number) {
        sessionQuery = sessionQuery.eq('table_number', orderData.table_number);
      }

      await sessionQuery;
    }
  } catch (error) {
      // Error silently handled
    }
}

