import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logInfo, logError } from "@/lib/logger";

export interface StaffCounts {
  total_staff: number;
  active_staff: number;
  unique_roles: number;
  active_shifts_count: number;
}

export function useStaffCounts(venueId: string) {
  const [data, setData] = useState<StaffCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!venueId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      const { data: result, error: rpcError } = await supabase
        .rpc('staff_counts', { 
          p_venue_id: venueId
        })
        .single();
      
      if (rpcError) {
        logError('[STAFF_COUNTS] RPC error:', rpcError);
        setError(rpcError.message);
        return;
      }
      
      logInfo('[STAFF_COUNTS] RPC result:', result);
      setData(result);
    } catch (err) {
      logError('[STAFF_COUNTS] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { data, isLoading, error, refetch: fetchCounts };
}
