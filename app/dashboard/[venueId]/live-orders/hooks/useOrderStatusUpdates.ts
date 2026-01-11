import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Order } from "../types";
import { TERMINAL_STATUSES } from "../constants";

export async function updateOrderStatus(

  todayWindow: { startUtcISO: string; endUtcISO: string } | null,
  onUpdate: (orderId: string, status: Order["order_status"]) => void,
  onMoveToAllToday: (orderId: string, status: Order["order_status"]) => void,

  const { data: orderData } = await supabase
    .from("orders")
    .select("id, table_id, table_number, source, created_at")
    .eq("id", orderId)
    .eq("venue_id", venueId)
    .single();

  const { error } = await supabase
    .from("orders")
    .update({

    .eq("id", orderId)
    .eq("venue_id", venueId);

  if (!error) {
    if (TERMINAL_STATUSES.includes(orderStatus)) {
      onRemove(orderId);

      if (orderData && orderData.created_at) {
        const orderCreatedAt = new Date(orderData.created_at);
        if (
          todayWindow &&
          orderCreatedAt >= new Date(todayWindow.startUtcISO) &&
          orderCreatedAt < new Date(todayWindow.endUtcISO)
        ) {
          onMoveToAllToday(orderId, orderStatus);
        }
      }
    } else {
      onUpdate(orderId, orderStatus);
    }

    // Handle table cleanup for QR orders
    if (
      (orderStatus === "COMPLETED" || orderStatus === "CANCELLED") &&
      orderData &&
      (orderData.table_id || orderData.table_number) &&
      orderData.source === "qr"
    ) {
      await clearTableSession(orderData, venueId, orderId);
    }
  }
}

interface OrderDataWithTable {
  table_id?: string;
  table_number?: number;
  source?: string;
  created_at?: string;
  id?: string;
}

async function clearTableSession(orderData: unknown, venueId: string, orderId: string) {
  try {
    const supabase = createClient();
    const orderInfo = orderData as OrderDataWithTable;

    interface ActiveOrder {

    }

    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id, order_status, table_id, table_number")
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
      .neq("id", orderId);

    let filteredActiveOrders = (activeOrders as ActiveOrder[] | null) || [];
    if (orderInfo.table_id) {
      filteredActiveOrders = filteredActiveOrders.filter((o) => o.table_id === orderInfo.table_id);
    } else if (orderInfo.table_number) {
      filteredActiveOrders = filteredActiveOrders.filter(
        (o) => o.table_number === orderInfo.table_number
      );
    }

    if (!filteredActiveOrders || filteredActiveOrders.length === 0) {
      const sessionUpdateData = {

      };

      let sessionQuery = supabase
        .from("table_sessions")
        .update(sessionUpdateData)
        .eq("venue_id", venueId)
        .is("closed_at", null);

      if (orderInfo.table_id) {
        sessionQuery = sessionQuery.eq("table_id", orderInfo.table_id);
      } else if (orderInfo.table_number) {
        sessionQuery = sessionQuery.eq("table_number", orderInfo.table_number);
      }

      await sessionQuery;
    }
  } catch (_error) {
    // Error silently handled
  }
}
