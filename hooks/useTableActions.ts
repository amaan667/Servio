
import { useState } from "react";

export interface TableActionParams {
  action:
    | "start_preparing"
    | "mark_ready"
    | "mark_served"
    | "mark_awaiting_bill"
    | "close_table"
    | "reserve_table"
    | "occupy_table"
    | "move_table"
    | "merge_table"
    | "unmerge_table"
    | "cancel_reservation";
  table_id: string;
  venue_id: string;
  order_id?: string;
  destination_table_id?: string;
  customer_name?: string;
  reservation_time?: string;
  reservation_id?: string;
}

export function useTableActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAction = async (params: TableActionParams) => {
    try {
      setLoading(true);
      setError(null);

      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post("/api/table-sessions/actions", params);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute action");
      }

      return data;
    } catch (_err) {

      const errorMessage = _err instanceof Error ? _err.message : "Failed to execute action";
      setError(errorMessage);
      throw _err;
    } finally {
      setLoading(false);
    }
  };

  const startPreparing = (table_id: string, venue_id: string, order_id: string) =>
    executeAction({ action: "start_preparing", table_id, venue_id, order_id });

  const markReady = (table_id: string, venue_id: string, order_id: string) =>
    executeAction({ action: "mark_ready", table_id, venue_id, order_id });

  const markServed = (table_id: string, venue_id: string, order_id: string) =>
    executeAction({ action: "mark_served", table_id, venue_id, order_id });

  const markAwaitingBill = (table_id: string, venue_id: string) =>
    executeAction({ action: "mark_awaiting_bill", table_id, venue_id });

  const closeTable = (table_id: string, venue_id: string) =>
    executeAction({ action: "close_table", table_id, venue_id });

  const reserveTable = (
    table_id: string,
    venue_id: string,
    customer_name: string,
    reservation_time: string
  ) =>
    executeAction({ action: "reserve_table", table_id, venue_id, customer_name, reservation_time });

  const occupyTable = (table_id: string, venue_id: string) =>
    executeAction({ action: "occupy_table", table_id, venue_id });

  const moveTable = (table_id: string, venue_id: string, destination_table_id: string) =>
    executeAction({ action: "move_table", table_id, venue_id, destination_table_id });

  const mergeTable = (table_id: string, venue_id: string, destination_table_id: string) =>
    executeAction({ action: "merge_table", table_id, venue_id, destination_table_id });

  const unmergeTable = (table_id: string, venue_id: string) =>
    executeAction({ action: "unmerge_table", table_id, venue_id });

  return {
    loading,
    error,
    startPreparing,
    markReady,
    markServed,
    markAwaitingBill,
    closeTable,
    reserveTable,
    occupyTable,
    moveTable,
    mergeTable,
    unmergeTable,
    executeAction,
  };
}
