import { useState } from "react";
import { Order } from "../types";
import { toast } from "@/hooks/use-toast";

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
        toast({
          title: "Success",
          description: `Successfully completed ${completedCount ?? 0} orders!`,
          variant: "success",
        });
        onComplete();
      } else {
        toast({
          title: "Error",
          description: `Error completing orders: ${errorMessage}`,
          variant: "destructive",
        });
      }
    } catch (_err) {
      toast({
        title: "Error",
        description: "Error completing orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBulkCompleting(false);
    }
  };

  return {
    isBulkCompleting,
    bulkCompleteAllOrders,
  };
}
