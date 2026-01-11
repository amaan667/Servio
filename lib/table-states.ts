/**
 * Table State Management Utilities
 * Implements the comprehensive table merge logic as specified
 */

export type TableState = "FREE" | "OCCUPIED" | "RESERVED" | "BLOCKED" | "CLEANING";

export interface TableStateInfo {

  };
}

export interface MergeScenario {

}

interface TableData {
  session_id?: string | null;
  status?: string | null;
  order_id?: string | null;
  reserved_now_id?: string | null;
  reserved_later_id?: string | null;
  order_status?: string | null;
  completion_status?: string | null; // Unified lifecycle field
}

/**
 * Determines the current state of a table based on its session and reservation data
 */
export function getTableState(table: TableData): TableStateInfo {
  const hasSession = !!table.session_id && table.status !== "FREE";
  // An order is only "active" if it's not completed
  // Check completion_status first (unified lifecycle), fallback to order_status
  const isOrderCompleted =
    table.completion_status?.toUpperCase() === "COMPLETED" ||
    (table.order_status &&
      ["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(table.order_status.toUpperCase()));
  const hasActiveOrder = !!table.order_id && !isOrderCompleted;
  const hasReservation = !!(table.reserved_now_id || table.reserved_later_id);
  const sessionStatus = table.status;

  // Priority order: BLOCKED > OCCUPIED > RESERVED > FREE

  // Check if table is blocked/cleaning (manual status)
  if (sessionStatus === "CLEANING" || sessionStatus === "BLOCKED") {
    return {

        hasActiveOrder,
        hasReservation,
        sessionStatus,
      },
    };
  }

  // Check if table is occupied (has live session OR active order)
  if (
    hasSession &&
    sessionStatus &&
    ["ORDERING", "IN_PREP", "READY", "SERVED", "AWAITING_BILL"].includes(sessionStatus)
  ) {
    return {

      reason: `Table has active session (${sessionStatus})`,

        hasActiveOrder,
        hasReservation,

      },
    };
  }

  // Check if table has active order even without session
  if (hasActiveOrder) {
    return {

        hasActiveOrder,
        hasReservation,

      },
    };
  }

  // Check if table is reserved
  if (hasReservation || sessionStatus === "RESERVED") {
    return {

        hasActiveOrder,
        hasReservation,

      },
    };
  }

  // Default to FREE
  return {

      hasActiveOrder,
      hasReservation,

    },
  };
}

/**
 * Determines the merge scenario between two tables
 */
export function getMergeScenario(sourceTable: TableData, targetTable: TableData): MergeScenario {
  const sourceState = getTableState(sourceTable);
  const targetState = getTableState(targetTable);

  // Blocked tables are never eligible for merging
  if (sourceState.state === "BLOCKED" || targetState.state === "BLOCKED") {
    return {

    };
  }

  // Check if tables are already merged (same session)
  if (
    sourceTable.session_id &&
    targetTable.session_id &&
    sourceTable.session_id === targetTable.session_id
  ) {
    return {

    };
  }

  // Scenario 1: Free + Free ✅ (always allowed)
  if (sourceState.state === "FREE" && targetState.state === "FREE") {
    return {

    };
  }

  // Scenario 2: Free + Occupied ✅ (Expansion)
  if (sourceState.state === "FREE" && targetState.state === "OCCUPIED") {
    return {

    };
  }

  // Scenario 3: Occupied + Free ✅ (Expansion)
  if (sourceState.state === "OCCUPIED" && targetState.state === "FREE") {
    return {

    };
  }

  // Scenario 4: Free + Reserved ⚠️ (Expansion of reservation)
  if (sourceState.state === "FREE" && targetState.state === "RESERVED") {
    return {

    };
  }

  // Scenario 5: Reserved + Free ⚠️ (Expansion of reservation)
  if (sourceState.state === "RESERVED" && targetState.state === "FREE") {
    return {

    };
  }

  // Scenario 6: Occupied + Occupied ⚠️ (Merge sessions)
  if (sourceState.state === "OCCUPIED" && targetState.state === "OCCUPIED") {
    return {

    };
  }

  // Scenario 7: Reserved + Reserved ⚠️ (Same reservation only)
  if (sourceState.state === "RESERVED" && targetState.state === "RESERVED") {
    // Check if it's the same reservation
    const sameReservation =
      (sourceTable.reserved_now_id &&
        sourceTable.reserved_now_id === targetTable.reserved_now_id) ||
      (sourceTable.reserved_later_id &&
        sourceTable.reserved_later_id === targetTable.reserved_later_id);

    if (sameReservation) {
      return {

      };
    } else {
      return {

      };
    }
  }

  // Scenario 8: Reserved + Occupied ❌ (different parties)
  if (
    (sourceState.state === "RESERVED" && targetState.state === "OCCUPIED") ||
    (sourceState.state === "OCCUPIED" && targetState.state === "RESERVED")
  ) {
    return {

    };
  }

  // Default case
  return {

  };
}

/**
 * Filters tables for merge selection based on source table state
 */
export function getMergeableTables(
  sourceTable: Record<string, unknown>,
  availableTables: Record<string, unknown>[],

      const scenario = getMergeScenario(sourceTable, table);

      return {
        ...table,

      };

    .filter((table) => {
      if (showAllTables) {
        // Show all tables, but mark ineligible ones
        return true;
      } else {
        // Default: only show FREE tables (safe, most common case)
        return table.state === "FREE";
      }

}

/**
 * Gets the display label for a table state
 */
export function getStateDisplayLabel(state: TableState): string {
  switch (state) {
    case "FREE":
      return "Free";
    case "OCCUPIED":
      return "Occupied";
    case "RESERVED":
      return "Reserved";
    case "BLOCKED":
      return "Blocked";
    case "CLEANING":
      return "Cleaning";

  }
}

/**
 * Gets the color class for a table state
 */
export function getStateColorClass(state: TableState): string {
  switch (state) {
    case "FREE":
      return "bg-green-100 text-green-800 border-green-200";
    case "OCCUPIED":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "RESERVED":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "BLOCKED":
      return "bg-red-100 text-red-800 border-red-200";
    case "CLEANING":
      return "bg-gray-100 text-gray-800 border-gray-200";

  }
}

/**
 * Gets the icon for a table state
 */
export function getStateIcon(state: TableState) {
  // This will be imported from lucide-react in the component
  switch (state) {
    case "FREE":
      return "CheckCircle2";
    case "OCCUPIED":
      return "Users";
    case "RESERVED":
      return "Calendar";
    case "BLOCKED":
      return "XCircle";
    case "CLEANING":
      return "Sparkles";

  }
}
