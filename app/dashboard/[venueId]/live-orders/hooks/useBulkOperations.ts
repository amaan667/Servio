import { useState } from "react";
import { Order } from "../types";

export function useBulkOperations(venueId: string) {
  const [isBulkCompleting, setIsBulkCompleting] = useState(false);

  const bulkCompleteAllOrders = async (activeOrders: Order[], onComplete: () => void) => {
    if (isBulkCompleting || activeOrders.length === 0) return;

    try {
      setIsBulkCompleting(true);

      const confirmed = confirm(
        `Are you sure you want to complete all ${activeOrders.length} active orders?`
      );
      if (!confirmed) return;

      const response = await fetch("/api/orders/bulk-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venueId,
          orderIds: activeOrders.map((order) => order.id),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`Successfully completed ${result.completedCount} orders!`);
        onComplete();
      } else {
        alert(`Error completing orders: ${result.error || "Unknown error"}`);
      }
    } catch (_error) {
      alert("Error completing orders. Please try again.");
    } finally {
      setIsBulkCompleting(false);
    }
  };

  return {
    isBulkCompleting,
    bulkCompleteAllOrders,
  };
}
