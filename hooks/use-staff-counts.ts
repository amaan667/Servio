import { errorToContext } from "@/lib/utils/error-to-context";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

export interface StaffCounts {

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
        .rpc("staff_counts", {

        .single();

      if (rpcError) {
        
        setError(rpcError.message);
        return;
      }

      setData(result as StaffCounts | null);
    } catch (_err) {
      );
      setError(_err instanceof Error ? _err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { data, isLoading, error, refetch: fetchCounts };
}
