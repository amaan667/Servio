import { useState, useEffect } from "react";
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

export function useTableManagementState(venueId: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [isManualResetting, setIsManualResetting] = useState(false);

  // Tables and counters
  const {

  } = useTableGrid(venueId, 30);

  const {
    data: counters = { total_tables: 0, available: 0, occupied: 0, reserved_overlapping_now: 0 },

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
