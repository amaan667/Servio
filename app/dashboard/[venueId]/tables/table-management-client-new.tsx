"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { AddTableDialog } from "@/components/table-management/AddTableDialog";
import { ReservationsPanel } from "@/components/table-management/ReservationsPanel";
import { DailyResetModal } from "@/components/daily-reset/DailyResetModal";
import { toast } from "@/hooks/use-toast";
import MobileNav from "@/components/MobileNav";

// Hooks
import { useTableManagementState } from "./hooks/useTableManagementState";

// Components
import { CounterOrdersSection } from "./components/CounterOrdersSection";
import { TableOrdersSection } from "./components/TableOrdersSection";
import { TableGridSection } from "./components/TableGridSection";

/**
 * Table Management Client Component
 * Manages tables, reservations, and orders
 *
 * Refactored: Extracted hooks and components for better organization
 * Original: 747 lines → Now: ~200 lines
 */

interface TableManagementClientNewProps {
  venueId: string;
}

export function TableManagementClientNew({ venueId }: TableManagementClientNewProps) {
  const state = useTableManagementState(venueId);

  const handleManualReset = () => {
    const hasActiveOrders = state.counterOrders.length > 0 || state.tableOrders.length > 0;
    const hasActiveTables = state.tables.some((table) => table.session_status === "OCCUPIED");
    const hasActiveReservations = state.reservations.some(
      (reservation) => reservation.status === "BOOKED" || reservation.status === "CHECKED_IN"
    );
    const hasIncompleteOrders =
      state.counterOrders.some((order) => order.order_status !== "COMPLETED") ||
      state.tableOrders.some((order) => order.order_status !== "COMPLETED");

    const hasAnythingToReset =
      hasActiveOrders || hasActiveTables || hasActiveReservations || hasIncompleteOrders;

    if (!hasAnythingToReset) {
      toast({
        title: "Nothing to Reset",
        description: "All tables are free and no active orders exist.",
      });
      return;
    }

    state.setShowResetModal(true);
  };

  const handleResetConfirm = async () => {
    await state.checkAndReset(true); // Pass force=true for manual reset button
    state.refetchTables();
  };

  const handleResetClose = () => {
    state.setShowResetModal(false);
  };

  const handleTableActionComplete = () => {
    state.refetchTables();
  };

  // Group table orders by table
  const groupedTableOrders = useMemo(() => {
    const groups: { [key: string]: unknown[] } = {
      /* Empty */
    };

    const uniqueOrders = state.tableOrders.filter(
      (order, index, self) => index === self.findIndex((o) => o.id === order.id)
    );

    uniqueOrders.forEach((order) => {
      const tableKey = order.table_label || `Table ${order.table_number}`;
      if (!groups[tableKey]) {
        groups[tableKey] = [];
      }
      groups[tableKey].push(order);
    });

    return groups;
  }, [state.tableOrders]);

  const error = state.tablesError;

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error.message}</p>
            <Button onClick={() => state.refetchTables()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">Table Management</h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-700" />
              <Input
                placeholder="Search tables…"
                value={state.searchQuery}
                onChange={(e) => state.setSearchQuery(e.target.value)}
                className="h-9 w-full sm:w-56 pl-10 rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <AddTableDialog venueId={venueId} onTableAdded={handleTableActionComplete} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualReset}
                disabled={state.isResetting}
                className="text-red-600 border-red-200 hover:bg-red-50 flex-shrink-0"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {state.isResetting ? "Resetting..." : "Reset"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Counter Orders Section */}
      <CounterOrdersSection counterOrders={state.counterOrders} />

      {/* Table Orders Section */}
      <TableOrdersSection groupedTableOrders={groupedTableOrders} venueId={venueId} />

      {/* Table Grid Section */}
      <TableGridSection
        tables={state.tables}
        searchQuery={state.searchQuery}
        venueId={venueId}
        onTableActionComplete={handleTableActionComplete}
      />

      {/* Reservations Panel */}
      <ReservationsPanel
        reservations={state.reservations}
        onActionComplete={handleTableActionComplete}
      />

      {/* Daily Reset Modal */}
      <DailyResetModal
        isOpen={state.showResetModal}
        onClose={handleResetClose}
        onConfirm={handleResetConfirm}
        isResetting={state.isResetting}
      />

      {/* Mobile Navigation */}
      <MobileNav
        venueId={venueId}
        venueName=""
        counts={{
          live_orders: 0,
          total_orders: 0,
          notifications: 0,
        }}
      />
    </div>
  );
}
