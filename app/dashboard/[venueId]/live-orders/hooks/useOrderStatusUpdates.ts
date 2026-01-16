import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Order } from "../types";
import { TERMINAL_STATUSES } from "../constants";

export async function updateOrderStatus(
  orderId: string,
  orderStatus: Order["order_status"],
  venueId: string,
  todayWindow: { startUtcISO: string; endUtcISO: string } | null,
  onUpdate: (orderId: string, status: Order["order_status"]) => void,
  onMoveToAllToday: (orderId: string, status: Order["order_status"]) => void,
  onRemove: (orderId: string) => void
) {
  const supabase = createClient();

  const { data: orderData } = await supabase
    .from("orders")
    .select("id, table_id, table_number, source, created_at")
    .eq("id", orderId)
    .eq("venue_id", venueId)
    .single();

  const normalizedStatus = (orderStatus || "").toUpperCase();
  let response: Response | null = null;

  if (normalizedStatus === "SERVED") {
    response = await fetch("/api/orders/serve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
  } else if (normalizedStatus === "COMPLETED") {
    response = await fetch("/api/orders/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
  } else {
    response = await fetch("/api/orders/set-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: normalizedStatus }),
    });
  }

  const error = response && !response.ok ? new Error("Status update failed") : null;

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

    // Table cleanup is handled server-side for terminal statuses
  }
}

