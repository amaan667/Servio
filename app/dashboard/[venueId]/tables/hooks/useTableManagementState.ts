import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTableGrid, useTableCounters, useReservations } from "@/hooks/useTableReservations";
import {
  useCounterOrders,
  useCounterOrderCounts,
  useCounterOrdersRealtime,
} from "@/hooks/useCounterOrders";
import {
  useTableOrders,
  useTableOrderCounts,
  useTableOrdersRealtime,
} from "@/hooks/useTableOrders";
import { useGroupSessions } from "@/hooks/useGroupSessions";
import { useDailyReset } from "@/hooks/useDailyReset";
import type { TableGridItem } from "@/hooks/useTableReservations";

interface InitialStats {
  total_tables: number;
  occupied: number;
  reserved: number;
  available: number;
}

export function useTableManagementState(
  venueId: string,
  initialTables?: Record<string, unknown>[] | null,
  initialStats?: InitialStats | null
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [isManualResetting, setIsManualResetting] = useState(false);
  const queryClient = useQueryClient();

  // Set initial tables data into cache for instant SSR hydration
  useEffect(() => {
    if (initialTables && initialTables.length > 0) {
      // Transform initial tables to match TableGridItem format
      const transformedTables: TableGridItem[] = initialTables.map(
        (table: Record<string, unknown>) => ({
          id: table.id as string,
          label: table.label as string,
          seat_count: table.seat_count as number,
          session_status: "FREE", // Default, will be updated by real-time
          reservation_status: "NONE",
          opened_at: null,
          order_id: null,
          total_amount: null,
          order_status: null,
          payment_status: null,
          order_updated_at: null,
        })
      );

      queryClient.setQueryData(["tables", "grid", venueId, 30], transformedTables);
    }
  }, [initialTables, venueId, queryClient]);

  // Set initial counters data into cache
  useEffect(() => {
    if (initialStats) {
      queryClient.setQueryData(["tables", "counters", venueId], {
        total_tables: initialStats.total_tables,
        available: initialStats.available,
        occupied: initialStats.occupied,
        reserved_overlapping_now: initialStats.reserved,
      });
    }
  }, [initialStats, venueId, queryClient]);

  // Tables and counters
  const {
    data: tables = [],
    isLoading: tablesLoading,
    error: tablesError,
    refetch: refetchTables,
  } = useTableGrid(venueId, 30);

  const {
    data: counters = { total_tables: 0, available: 0, occupied: 0, reserved_overlapping_now: 0 },
    isLoading: countersLoading,
  } = useTableCounters(venueId);

  const { data: reservations = [], isLoading: reservationsLoading } = useReservations(venueId);

  // Group sessions
  const { groupSessions } = useGroupSessions(venueId);

  // Daily reset
  const { isChecking: isResetting, resetResult, checkAndReset } = useDailyReset(venueId);

  // Counter orders
  const { data: counterOrders = [] } = useCounterOrders(venueId);
  const { data: counterOrderCounts = { total: 0, pending: 0, in_prep: 0, ready: 0 } } =
    useCounterOrderCounts(venueId);
  useCounterOrdersRealtime(venueId);

  // Table orders
  const { data: tableOrders = [] } = useTableOrders(venueId);
  const { data: tableOrderCounts = { total: 0, pending: 0, in_prep: 0, ready: 0 } } =
    useTableOrderCounts(venueId);
  useTableOrdersRealtime(venueId);

  // Add focus-based refresh
  useEffect(() => {
    const handleFocus = () => {
      refetchTables();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchTables]);

  return {
    searchQuery,
    setSearchQuery,
    showResetModal,
    setShowResetModal,
    isManualResetting,
    setIsManualResetting,
    tables,
    tablesLoading,
    tablesError,
    refetchTables,
    counters,
    countersLoading,
    reservations,
    reservationsLoading,
    groupSessions,
    isResetting,
    resetResult,
    checkAndReset,
    counterOrders,
    counterOrderCounts,
    tableOrders,
    tableOrderCounts,
  };
}
