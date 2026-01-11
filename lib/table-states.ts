/**
 * Table State Management Utilities
 * Implements the comprehensive table merge logic as specified
 */

export type TableState = "FREE" | "OCCUPIED" | "RESERVED" | "BLOCKED" | "CLEANING";

export interface TableStateInfo {
  state: TableState;
  reason: string;
  details?: {
    hasSession: boolean;
    hasActiveOrder: boolean;
    hasReservation: boolean;
    sessionStatus?: string;
    orderStatus?: string;
    reservationStatus?: string;
  };
}

export interface MergeScenario {
  type:
    | "FREE_FREE"
    | "FREE_OCCUPIED"
    | "FREE_RESERVED"
    | "OCCUPIED_OCCUPIED"
    | "RESERVED_RESERVED"
    | "RESERVED_OCCUPIED"
    | "BLOCKED"
    | "INVALID";
  allowed: boolean;
  requiresConfirmation: boolean;
  warning?: string;
  description: string;
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
      state: "BLOCKED",
      reason: "Table is blocked or being cleaned",
      details: {
        hasSession,
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
      state: "OCCUPIED",
      reason: `Table has active session (${sessionStatus})`,
      details: {
        hasSession,
        hasActiveOrder,
        hasReservation,
        sessionStatus: sessionStatus || undefined,
        orderStatus: table.order_status || undefined,
      },
    };
  }

  // Check if table has active order even without session
  if (hasActiveOrder) {
    return {
      state: "OCCUPIED",
      reason: "Table has active order",
      details: {
        hasSession,
        hasActiveOrder,
        hasReservation,
        orderStatus: table.order_status || undefined,
      },
    };
  }

  // Check if table is reserved
  if (hasReservation || sessionStatus === "RESERVED") {
    return {
      state: "RESERVED",
      reason: "Table has active reservation",
      details: {
        hasSession,
        hasActiveOrder,
        hasReservation,
        sessionStatus: sessionStatus || undefined,
        reservationStatus: hasReservation ? "ACTIVE" : undefined,
      },
    };
  }

  // Default to FREE
  return {
    state: "FREE",
    reason: "Table is available for seating",
    details: {
      hasSession,
      hasActiveOrder,
      hasReservation,
      sessionStatus: sessionStatus || undefined,
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
      type: "BLOCKED",
      allowed: false,
      requiresConfirmation: false,
      description: "Blocked tables cannot be merged",
    };
  }

  // Check if tables are already merged (same session)
  if (
    sourceTable.session_id &&
    targetTable.session_id &&
    sourceTable.session_id === targetTable.session_id
  ) {
    return {
      type: "INVALID",
      allowed: false,
      requiresConfirmation: false,
      description: "Tables are already merged",
    };
  }

  // Scenario 1: Free + Free ✅ (always allowed)
  if (sourceState.state === "FREE" && targetState.state === "FREE") {
    return {
      type: "FREE_FREE",
      allowed: true,
      requiresConfirmation: false,
      description: "Combine two empty tables for a bigger party",
    };
  }

  // Scenario 2: Free + Occupied ✅ (Expansion)
  if (sourceState.state === "FREE" && targetState.state === "OCCUPIED") {
    return {
      type: "FREE_OCCUPIED",
      allowed: true,
      requiresConfirmation: false,
      description: "Add free table to occupied table for expansion",
    };
  }

  // Scenario 3: Occupied + Free ✅ (Expansion)
  if (sourceState.state === "OCCUPIED" && targetState.state === "FREE") {
    return {
      type: "FREE_OCCUPIED",
      allowed: true,
      requiresConfirmation: false,
      description: "Add free table to occupied table for expansion",
    };
  }

  // Scenario 4: Free + Reserved ⚠️ (Expansion of reservation)
  if (sourceState.state === "FREE" && targetState.state === "RESERVED") {
    return {
      type: "FREE_RESERVED",
      allowed: true,
      requiresConfirmation: false,
      description: "Add free table to reservation for larger party",
    };
  }

  // Scenario 5: Reserved + Free ⚠️ (Expansion of reservation)
  if (sourceState.state === "RESERVED" && targetState.state === "FREE") {
    return {
      type: "FREE_RESERVED",
      allowed: true,
      requiresConfirmation: false,
      description: "Add free table to reservation for larger party",
    };
  }

  // Scenario 6: Occupied + Occupied ⚠️ (Merge sessions)
  if (sourceState.state === "OCCUPIED" && targetState.state === "OCCUPIED") {
    return {
      type: "OCCUPIED_OCCUPIED",
      allowed: true,
      requiresConfirmation: true,
      warning:
        "This will merge two active bills into one. Outstanding unpaid balances will be combined.",
      description: "Merge two active sessions (requires confirmation)",
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
        type: "RESERVED_RESERVED",
        allowed: true,
        requiresConfirmation: true,
        warning: "This will merge two tables for the same reservation.",
        description: "Merge tables for the same reservation",
      };
    } else {
      return {
        type: "RESERVED_RESERVED",
        allowed: false,
        requiresConfirmation: false,
        warning: "Cannot merge tables with different reservations (would mix different parties).",
        description: "Different reservations cannot be merged",
      };
    }
  }

  // Scenario 8: Reserved + Occupied ❌ (different parties)
  if (
    (sourceState.state === "RESERVED" && targetState.state === "OCCUPIED") ||
    (sourceState.state === "OCCUPIED" && targetState.state === "RESERVED")
  ) {
    return {
      type: "RESERVED_OCCUPIED",
      allowed: false,
      requiresConfirmation: false,
      warning: "Cannot merge a future reservation with a current live party.",
      description: "Cannot merge reservation with occupied table",
    };
  }

  // Default case
  return {
    type: "INVALID",
    allowed: false,
    requiresConfirmation: false,
    description: "Invalid merge scenario",
  };
}

/**
 * Filters tables for merge selection based on source table state
 */
export function getMergeableTables(
  sourceTable: Record<string, unknown>,
  availableTables: Record<string, unknown>[],
  showAllTables: boolean = false
) {
  const sourceState = getTableState(sourceTable);

  return availableTables
    .filter((table) => table.id !== sourceTable.id) // Exclude source table
    .map((table) => {
      const state = getTableState(table);
      const scenario = getMergeScenario(sourceTable, table);

      return {
        ...table,
        state: state.state,
        stateInfo: state,
        mergeScenario: scenario,
        selectable: scenario.allowed,
        requiresConfirmation: scenario.requiresConfirmation,
      };
    })
    .filter((table) => {
      if (showAllTables) {
        // Show all tables, but mark ineligible ones
        return true;
      } else {
        // Default: only show FREE tables (safe, most common case)
        return table.state === "FREE";
      }
    });
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
    default:
      return "Unknown";
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
    default:
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
    default:
      return "Circle";
  }
}
