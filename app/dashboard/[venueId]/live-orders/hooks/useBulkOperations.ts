import { useState } from "react";
import { Order } from "../types";

export function useBulkOperations(venueId: string) {
  const [isBulkCompleting, setIsBulkCompleting] = useState(false);

  const bulkCompleteAllOrders = async (activeOrders: Order[], onComplete: () => void) => {
    if (isBulkCompleting || activeOrders.length === 0) return;

    const orderIds = activeOrders.map((order) => order.id);
    const payload = { venueId, orderIds };

    try {
      setIsBulkCompleting(true);

      const confirmed = confirm(
        `Are you sure you want to complete all ${activeOrders.length} active orders?`
      );
      if (!confirmed) {
        return;
      }

      const response = await fetch("/api/orders/bulk-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      const data = result?.data ?? result;
      const completedCount =
        typeof data?.completedCount === "number" ? data.completedCount : data?.completedCount;
      const errorMessage =
        typeof result?.error === "string"
          ? result.error
          : (result?.error?.message ?? result?.message ?? "Unknown error");

      if (response.ok && result?.success !== false) {
        alert(`Successfully completed ${completedCount ?? 0} orders!`);
        onComplete();
      } else {
        alert(`Error completing orders: ${errorMessage}`);
      }
    } catch (_err) {
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
