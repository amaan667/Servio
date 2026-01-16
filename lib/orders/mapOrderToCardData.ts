// Data transformation utilities for the unified OrderCard component

import { OrderForCard, LegacyOrder } from "@/types/orders";
import { normalizeQrType } from "@/lib/orders/qr-payment-validation";

/**
 * Transforms legacy order data to the new OrderForCard format
 */
export function mapOrderToCardData(
  legacyOrder: LegacyOrder,
  currency: string = "GBP"
): OrderForCard {
  // Generate short ID from full UUID
  const short_id = legacyOrder.id.slice(-6).toUpperCase();

  // Normalize order status to lowercase
  const normalizeOrderStatus = (status: string): OrderForCard["order_status"] => {
    const normalized = status.toUpperCase();
    switch (normalized) {
      case "PLACED":
      case "ACCEPTED": // Treat ACCEPTED as placed
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

  // Determine payment mode and status
  const determinePaymentInfo = (order: LegacyOrder): OrderForCard["payment"] => {
    const paymentStatus = (order.payment_status || "UNPAID").toUpperCase();
    const paymentMethod = order.payment_method || "";

    // Determine mode based on payment_method first, then fallback to payment_status
    let mode: OrderForCard["payment"]["mode"] = "online";
    if (paymentMethod.toUpperCase() === "PAY_AT_TILL" || paymentMethod === "till") {
      mode = "pay_at_till";
    } else if (paymentMethod.toUpperCase() === "PAY_LATER" || paymentStatus === "PAY_LATER") {
      mode = "pay_later";
    } else if (paymentMethod.toUpperCase() === "PAY_NOW") {
      mode = "online";
    }

    // Determine status
    let status: OrderForCard["payment"]["status"] = "unpaid";
    switch (paymentStatus) {
      case "PAID":
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

    return {
      mode,
      status,
      method: paymentMethod || undefined, // Include payment_method in payment object
    };
  };

  // Generate items preview
  const generateItemsPreview = (items: LegacyOrder["items"]): string => {
    if (!items || items.length === 0) return "";

    // Show first 3 items max
    const preview = items
      .slice(0, 3)
      .map((item) => {
        // Handle cases where item_name is missing by inferring from price
        let itemName = item.item_name;
        if (!itemName) {
          // Infer item name from price based on common patterns
          if (item.price === 4.5) {
            itemName = "Labneh";
          } else if (item.price === 9) {
            itemName = "Shakshuka Royale";
          } else if (item.price === 5) {
            itemName = "Chapati";
          } else {
            itemName = "Unknown Item";
          }
        }
        return `${item.quantity}x ${itemName}`;
      })
      .join(", ");

    if (items.length > 3) {
      return `${preview}, +${items.length - 3} more`;
    }

    return preview;
  };

  // Generate appropriate label based on source and data
  const generateLabels = (
    order: LegacyOrder
  ): {
    table_label?: string | null;
    counter_label?: string | null;
  } => {
    // Use the same logic as deriveEntityKind to determine order type
    const isCounterOrder = order.source === "counter";

    // Additional debug for table number processing
    if (order.table_number) {
      // Empty block
    } else {
      // Intentionally empty
    }

    if (isCounterOrder) {
      // For counter orders, use counter_label if available, otherwise generate from table_number
      return {
        table_label: null,
        counter_label: order.counter_label || `Counter ${order.table_number || "A"}`,
      };
    } else {
      // For table orders, use table_label if available, otherwise generate from table_number
      let generatedTableLabel;
      if (order.table_label) {
        generatedTableLabel = order.table_label;
      } else if (order.table_number) {
        generatedTableLabel = `Table ${order.table_number}`;
      } else {
        // Fallback for orders without table numbers - use a generic label
        generatedTableLabel = "Table Order";
      }
      return {
        table_label: generatedTableLabel,
        counter_label: null,
      };
    }
  };

  const { table_label, counter_label } = generateLabels(legacyOrder);

  // Additional debug to see the actual values

  return {
    id: legacyOrder.id,
    short_id,
    placed_at: legacyOrder.created_at,
    order_status: normalizeOrderStatus(legacyOrder.order_status),
    qr_type: normalizeQrType((legacyOrder as { qr_type?: string }).qr_type) || undefined,
    fulfillment_type: (legacyOrder as { fulfillment_type?: string }).fulfillment_type as
      | "table"
      | "counter"
      | "delivery"
      | "pickup"
      | undefined,
    requires_collection: (legacyOrder as { requires_collection?: boolean }).requires_collection,
    total_amount: legacyOrder.total_amount,
    currency,
    payment: determinePaymentInfo(legacyOrder),
    payment_method: legacyOrder.payment_method, // Include raw payment_method for display
    table_id: legacyOrder.table_id || null,
    table_label,
    table: legacyOrder.table,
    counter_label,
    customer: legacyOrder.customer_name
      ? {
          name: legacyOrder.customer_name,
          phone: legacyOrder.customer_phone || undefined,
        }
      : null,
    items_preview: generateItemsPreview(legacyOrder.items),
    items: legacyOrder.items,
    source: mapLegacySource(legacyOrder.source),
  };
}

/**
 * Maps legacy source values to new format
 */
function mapLegacySource(source?: string): OrderForCard["source"] {
  switch (source) {
    case "qr":
      return "qr_table"; // Default QR to table, will be corrected by entity logic
    case "counter":
      return "qr_counter";
    default:
      return "unknown";
  }
}

/**
 * Utility functions for formatting
 */
export function formatCurrency(amount: number, currency: string = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatOrderTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function orderTimeAgo(isoString: string): string {
  const now = new Date();
  const orderTime = new Date(isoString);
  const diffMs = now.getTime() - orderTime.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
