import { useState, useCallback } from 'react';
import { getTableState, getMergeScenario, type TableState } from '@/lib/table-states';

interface Table {
  id: string;
  label: string;
  seat_count: number;
  status: string;
  session_id?: string | null;
  order_id?: string | null;
  total_amount?: number | null;
  order_status?: string | null;
  opened_at?: string | null;
  customer_name?: string | null;
  reserved_now_id?: string | null;
  reserved_now_start?: string | null;
  reserved_now_name?: string | null;
  reserved_later_id?: string | null;
  reserved_later_start?: string | null;
  reserved_later_name?: string | null;
}

interface MergeResult {
  success: boolean;
  data?: any;
  error?: string;
  scenario?: string;
  description?: string;
}

export function useEnhancedTableMerge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performMerge = useCallback(async (
    sourceTableId: string,
    targetTableId: string,
    venueId: string,
    confirmed: boolean = false
  ): Promise<MergeResult> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[ENHANCED_TABLE_MERGE] Performing merge:', {
        sourceTableId,
        targetTableId,
        venueId,
        confirmed
      });

      const response = await fetch('/api/table-sessions/enhanced-merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          source_table_id: sourceTableId,
          target_table_id: targetTableId,
          venue_id: venueId,
          confirmed
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[ENHANCED MERGE HOOK] Merge failed:', result);
        return {
          success: false,
          error: result.error || 'Merge failed',
          scenario: result.scenario,
          description: result.description
        };
      }

      return {
        success: true,
        data: result.data,
        scenario: result.scenario,
        description: result.description
      };

    } catch (error) {
      console.error('[ENHANCED MERGE HOOK] Unexpected error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateMerge = useCallback((sourceTable: Table, targetTable: Table) => {
    const sourceState = getTableState(sourceTable);
    const targetState = getTableState(targetTable);
    const mergeScenario = getMergeScenario(sourceTable, targetTable);

    return {
      allowed: mergeScenario.allowed,
      requiresConfirmation: mergeScenario.requiresConfirmation,
      warning: mergeScenario.warning,
      description: mergeScenario.description,
      scenario: mergeScenario.type,
      sourceState: sourceState.state,
      targetState: targetState.state
    };
  }, []);

  const getTableStateInfo = useCallback((table: Table) => {
    return getTableState(table);
  }, []);

  return {
    performMerge,
    validateMerge,
    getTableStateInfo,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}
