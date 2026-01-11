// Helper to map CounterOrder from useCounterOrders to OrderForCard format

import { CounterOrder } from "@/hooks/useCounterOrders";
import { OrderForCard } from "@/types/orders";

/**
 * Maps CounterOrder from useCounterOrders hook to OrderForCard format
 */
export function mapCounterOrderToCardData(

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

    short_id,

    currency,

    table_id: null, // Counter orders don't have table_id

    counter_label: `Counter ${counterOrder.table_number}`, // Use table_number as counter identifier

        }

      menu_item_id: "", // Not available in CounterOrder

      specialInstructions: undefined, // Not available in CounterOrder
    })),

  };
}
