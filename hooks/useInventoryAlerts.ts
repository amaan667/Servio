import { errorToContext } from "@/lib/utils/error-to-context";

import { useState, useEffect } from "react";
import type { LowStockAlert } from "@/types/inventory";

export function useInventoryAlerts(venueId: string | null) {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venueId) return;

    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const { apiClient } = await import("@/lib/api-client");
        const response = await apiClient.get("/api/inventory/low-stock", {
          params: { venue_id: venueId },

        const result = await response.json();
        if (result.data) {
          setAlerts(result.data);
        }
      } catch (_error) {
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);

    return () => clearInterval(interval);
  }, [venueId]);

  return { alerts, loading };
}
