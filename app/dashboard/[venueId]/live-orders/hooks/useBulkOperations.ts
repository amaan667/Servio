import { useState } from "react";
import { Order } from "../types";

export function useBulkOperations(venueId: string) {
  const [isBulkCompleting, setIsBulkCompleting] = useState(false);

  const bulkCompleteAllOrders = async (activeOrders: Order[], onComplete: () => void) => {
    if (isBulkCompleting || activeOrders.length === 0) return;

    const orderIds = activeOrders.map((order) => order.id);
    const payload = { venueId, orderIds };

    const log = (label: string, detail: unknown) => {
      console.log(`[Complete All] ${label}`, detail);
    };

    try {
      setIsBulkCompleting(true);
      log("clicked", {
        activeOrdersCount: activeOrders.length,
        orderIds,
        orderStatuses: activeOrders.map((o) => ({ id: o.id, order_status: o.order_status, payment_status: o.payment_status })),
      });

      const confirmed = confirm(
        `Are you sure you want to complete all ${activeOrders.length} active orders?`
      );
      if (!confirmed) {
        log("cancelled", "user cancelled confirm");
        return;
      }

      log("request", { url: "/api/orders/bulk-complete", payload });

      const response = await fetch("/api/orders/bulk-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      log("response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        result,
      });

      const data = result?.data ?? result;
      const completedCount = typeof data?.completedCount === "number" ? data.completedCount : data?.completedCount;
      const errorMessage =
        typeof result?.error === "string"
          ? result.error
          : result?.error?.message ?? result?.message ?? "Unknown error";

      if (response.ok && result?.success !== false) {
        log("success", { completedCount });
        alert(`Successfully completed ${completedCount ?? 0} orders!`);
        onComplete();
      } else {
        log("error", { errorMessage, resultError: result?.error });
        alert(`Error completing orders: ${errorMessage}`);
      }
    } catch (err) {
      log("exception", { error: err, message: err instanceof Error ? err.message : String(err) });
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
