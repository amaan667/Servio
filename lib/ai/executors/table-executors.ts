// Servio AI Assistant - Table Management Executors

import { AIExecutionResult, AIPreviewDiff } from "@/types/ai-assistant";
import {
  getTableAvailability,
  createTable,
  mergeTables,
  getTablesWithActiveOrders,
  getRevenueByTable,
} from "../tools/table-management-tools";

/**
 * Execute table availability query
 */
export async function executeTableGetAvailability(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getTableAvailability(venueId);

  return {
    success: true,
    toolName: "tables.get_availability",
    result: {
      available: result.available,
      occupied: result.occupied,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute table creation
 */
export async function executeTableCreate(
  params: { tableLabel: string; seats?: number },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "tables.create",
      before: [],
      after: [{ label: params.tableLabel, seats: params.seats || 4 }],
      impact: {
        itemsAffected: 1,
        description: `Will create ${params.tableLabel} with ${params.seats || 4} seats`,
      },
    };
  }

  const result = await createTable(venueId, params.tableLabel, params.seats);

  return {
    success: true,
    toolName: "tables.create",
    result: {
      table: result.table,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute table merge
 */
export async function executeTableMerge(
  params: { tableIds: string[]; mergedLabel?: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "tables.merge",
      before: params.tableIds.map((id) => ({ id })),
      after: [{ label: params.mergedLabel || "Merged Table" }],
      impact: {
        itemsAffected: params.tableIds.length,
        description: `Will merge ${params.tableIds.length} tables into one`,
      },
    };
  }

  const result = await mergeTables(venueId, params.tableIds, params.mergedLabel);

  return {
    success: true,
    toolName: "tables.merge",
    result: {
      mergedTableId: result.mergedTableId,
      originalTables: result.originalTables,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute query for tables with active orders
 */
export async function executeTableGetActiveOrders(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getTablesWithActiveOrders(venueId);

  return {
    success: true,
    toolName: "tables.get_active_orders",
    result: {
      tables: result.tables,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute revenue by table query
 */
export async function executeTableGetRevenue(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getRevenueByTable(venueId);

  return {
    success: true,
    toolName: "tables.get_revenue",
    result: {
      tables: result.tables,
      summary: result.summary,
    },
    auditId: "",
  };
}
