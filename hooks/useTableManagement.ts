import { useState } from 'react';

export interface CreateTableParams {
  venue_id: string;
  label: string;
  seat_count?: number;
}

export interface UpdateTableParams {
  id: string;
  label?: string;
  seat_count?: number;
  is_active?: boolean;
}

export function useTableManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTable = async (params: CreateTableParams) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create table');
      }

      return data.table;
    } catch (err) {
      console.error('[TABLE MANAGEMENT HOOK] Error creating table:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create table';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTable = async (params: UpdateTableParams) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tables/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: params.label,
          seat_count: params.seat_count,
          is_active: params.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update table');
      }

      return data.table;
    } catch (err) {
      console.error('[TABLE MANAGEMENT HOOK] Error updating table:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update table';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTable = async (tableId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tables/${tableId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete table');
      }

      return data;
    } catch (err) {
      console.error('[TABLE MANAGEMENT HOOK] Error deleting table:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete table';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createTable,
    updateTable,
    deleteTable,
  };
}
