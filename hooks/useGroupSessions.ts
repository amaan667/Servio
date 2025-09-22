import { useState, useEffect } from 'react';

interface GroupSession {
  id: string;
  venue_id: string;
  table_number: number;
  total_group_size: number;
  current_group_size: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseGroupSessionsReturn {
  groupSessions: GroupSession[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGroupSessions(venueId: string): UseGroupSessionsReturn {
  const [groupSessions, setGroupSessions] = useState<GroupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroupSessions = async () => {
    if (!venueId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/table/group-sessions?venueId=${venueId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch group sessions: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.ok) {
        setGroupSessions(data.groupSessions || []);
      } else {
        throw new Error(data.error || 'Failed to fetch group sessions');
      }
    } catch (err) {
      console.error('[USE GROUP SESSIONS] Error fetching group sessions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setGroupSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupSessions();
  }, [venueId]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchGroupSessions, 30000);
    return () => clearInterval(interval);
  }, [venueId]);

  return {
    groupSessions,
    loading,
    error,
    refetch: fetchGroupSessions
  };
}
