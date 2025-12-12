import { errorToContext } from "@/lib/utils/error-to-context";

import { useState } from "react";
import { logger } from "@/lib/logger";

interface DailyResetResult {
  success: boolean;
  message: string;
  resetDate?: string;
  alreadyReset?: boolean;
  summary?: {
    venueId: string;
    venueName: string;
    completedOrders: number;
    canceledReservations: number;
    deletedTables: number;
    timestamp: string;
  };
}

export function useDailyReset(venueId: string) {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResetDate, setLastResetDate] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<DailyResetResult | null>(null);

  const checkAndReset = async (force = false) => {
    if (!venueId || isChecking) return;

    try {
      setIsChecking(true);

      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post("/api/daily-reset/check-and-reset", { venueId, force });

      const result = await response.json();

      if (response.ok) {
        setResetResult(result);

        if (result.resetDate) {
          setLastResetDate(result.resetDate);
        }

        // If a reset was performed, show a notification
        if (result.success && !result.alreadyReset && result.summary) {
          const { completedOrders, canceledReservations, deletedTables } = result.summary;

          if (completedOrders > 0 || canceledReservations > 0 || deletedTables > 0) {
            // You could show a toast notification here
            // toast.success(`Daily reset completed: ${completedOrders} orders completed, ${deletedTables} tables deleted`);
          }
        }
      } else {
        logger.error("🔄 [DAILY RESET HOOK] Reset check failed:", result);
      }
    } catch (_error) {
      logger.error("🔄 [DAILY RESET HOOK] Error checking daily reset:", errorToContext(_error));
    } finally {
      setIsChecking(false);
    }
  };

  // Disabled automatic check - daily reset happens via cron job at midnight
  // Manual reset can still be triggered via the checkAndReset function if needed
  // useEffect(() => {
  //   if (venueId) {
  //     checkAndReset();
  //   }
  // }, [venueId]);

  return {
    isChecking,
    lastResetDate,
    resetResult,
    checkAndReset,
  };
}
