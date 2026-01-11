// Data transformation utilities for the unified OrderCard component

import { OrderForCard, LegacyOrder } from "@/types/orders";

/**
 * Transforms legacy order data to the new OrderForCard format
 */
export function mapOrderToCardData(

    }
  };

  // Determine payment mode and status
  const determinePaymentInfo = (order: LegacyOrder): OrderForCard["payment"] => {
    const paymentStatus = (order.payment_status || "UNPAID").toUpperCase();
    const paymentMethod = order.payment_method || "";

    // Determine mode based on payment_method first, then fallback to payment_status
    let mode: OrderForCard["payment"]["mode"] = "online";
    if (
      paymentMethod.toUpperCase() === "PAY_AT_TILL" ||
      paymentMethod === "till" ||
      paymentStatus === "TILL"
    ) {
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
      case "TILL": // TILL means paid at till
        status = "paid";
        break;
      case "REFUNDED":
        status = "refunded";
        break;
      case "FAILED":
        status = "failed";
        break;

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

      .join(", ");

    if (items.length > 3) {
      return `${preview}, +${items.length - 3} more`;
    }

    return preview;
  };

  // Generate appropriate label based on source and data
  const generateLabels = (

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

      };
    }
  };

  const { table_label, counter_label } = generateLabels(legacyOrder);

  // Additional debug to see the actual values

  return {

    short_id,

    currency,

    payment_method: legacyOrder.payment_method, // Include raw payment_method for display

    table_label,

    counter_label,

        }

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

  }
}

/**
 * Utility functions for formatting
 */
export function formatCurrency(amount: number, currency: string = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {

    currency,
  }).format(amount);
}

export function formatOrderTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-GB", {

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
