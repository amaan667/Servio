// Helper to map CounterOrder from useCounterOrders to OrderForCard format

import { CounterOrder } from "@/hooks/useCounterOrders";
import { OrderForCard } from "@/types/orders";

/**
 * Maps CounterOrder from useCounterOrders hook to OrderForCard format
 */
export function mapCounterOrderToCardData(
  counterOrder: CounterOrder,
  currency: string = "GBP"
): OrderForCard {
  // Generate short ID from full UUID
  const short_id = counterOrder.id.slice(-6).toUpperCase();

  // Normalize order status to lowercase
  const normalizeOrderStatus = (status: string): OrderForCard["order_status"] => {
    const normalized = status.toUpperCase();
    switch (normalized) {
      case "PLACED":
      case "ACCEPTED":
        return "placed";
      case "IN_PREP":
        return "preparing";
      case "READY":
        return "ready";
      case "SERVING":
        return "served";
      case "SERVED":
        return "served";
      case "COMPLETED":
        return "completed";
      case "CANCELLED":
      case "REFUNDED":
      case "EXPIRED":
        return "cancelled";
      default:
        return "placed";
    }
  };

  // Determine payment mode and status for counter orders
  const determinePaymentInfo = (order: CounterOrder): OrderForCard["payment"] => {
    const paymentStatus = (order.payment_status || "UNPAID").toUpperCase();

    // Counter orders are typically pay-at-till or pay-later
    const mode: OrderForCard["payment"]["mode"] = "pay_at_till";

    // Determine status
    let status: OrderForCard["payment"]["status"] = "unpaid";
    switch (paymentStatus) {
      case "PAID":
      case "TILL":
        status = "paid";
        break;
      case "REFUNDED":
        status = "refunded";
        break;
      case "FAILED":
        status = "failed";
        break;
      default:
        status = "unpaid";
    }

    return { mode, status };
  };

  // Generate items preview
  const generateItemsPreview = (items: CounterOrder["items"]): string => {
    if (!items || items.length === 0) return "";

    // Show first 3 items max
    const preview = items
      .slice(0, 3)
      .map((item) => `${item.quantity}x ${item.item_name}`)
      .join(", ");

    if (items.length > 3) {
      return `${preview}, +${items.length - 3} more`;
    }

    return preview;
  };

  return {
    id: counterOrder.id,
    short_id,
    placed_at: counterOrder.created_at,
    order_status: normalizeOrderStatus(counterOrder.order_status),
    total_amount: counterOrder.total_amount,
    currency,
    payment: determinePaymentInfo(counterOrder),
    table_id: null, // Counter orders don't have table_id
    table_label: null,
    table: null,
    counter_label: `Counter ${counterOrder.table_number}`, // Use table_number as counter identifier
    customer: counterOrder.customer_name
      ? {
          name: counterOrder.customer_name,
          phone: counterOrder.customer_phone || undefined,
        }
      : null,
    items_preview: generateItemsPreview(counterOrder.items),
    items: counterOrder.items?.map((item) => ({
      menu_item_id: "", // Not available in CounterOrder
      quantity: item.quantity,
      price: item.price,
      item_name: item.item_name,
      specialInstructions: undefined, // Not available in CounterOrder
    })),
    source: "qr_counter",
  };
}
