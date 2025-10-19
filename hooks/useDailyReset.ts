import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

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
        logger.error('🔄 [DAILY RESET HOOK] Reset check failed:', result);
      }
    } catch (error) {
      logger.error('🔄 [DAILY RESET HOOK] Error checking daily reset:', error);
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
