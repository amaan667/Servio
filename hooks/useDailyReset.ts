import { useEffect, useState } from 'react';
import { logInfo, logError } from "@/lib/logger";

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

  const checkAndReset = async () => {
    if (!venueId || isChecking) return;

    try {
      setIsChecking(true);
      logInfo('🔄 [DAILY RESET HOOK] Checking for daily reset needed...');

      const response = await fetch('/api/daily-reset/check-and-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ venueId }),
      });

      const result = await response.json();

      if (response.ok) {
        logInfo('🔄 [DAILY RESET HOOK] Reset check result:', result);
        setResetResult(result);
        
        if (result.resetDate) {
          setLastResetDate(result.resetDate);
        }

        // If a reset was performed, show a notification
        if (result.success && !result.alreadyReset && result.summary) {
          const { completedOrders, canceledReservations, deletedTables } = result.summary;
          
          if (completedOrders > 0 || canceledReservations > 0 || deletedTables > 0) {
            logInfo('🔄 [DAILY RESET HOOK] Daily reset performed:', {
              completedOrders,
              canceledReservations,
              deletedTables
            });
            
            // You could show a toast notification here
            // toast.success(`Daily reset completed: ${completedOrders} orders completed, ${deletedTables} tables deleted`);
          }
        }
      } else {
        logError('🔄 [DAILY RESET HOOK] Reset check failed:', result);
      }
    } catch (error) {
      logError('🔄 [DAILY RESET HOOK] Error checking daily reset:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Check for daily reset when the hook is first used
  useEffect(() => {
    if (venueId) {
      checkAndReset();
    }
  }, [venueId]);

  return {
    isChecking,
    lastResetDate,
    resetResult,
    checkAndReset
  };
}
