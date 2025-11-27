// Servio AI Assistant - Tool Executors
// Main router that delegates to specialized executor modules

import { ToolName, AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";

// Menu executors
import {
  executeMenuUpdatePrices,
  executeMenuToggleAvailability,
  executeMenuCreateItem,
  executeMenuDeleteItem,
} from "./executors/menu-executors";

// Extended Menu executors
import {
  executeMenuQueryNoImages,
  executeMenuUploadImage,
  executeMenuTranslateExtended,
} from "./executors/extended-menu-executors";

// Translation executor
import { executeMenuTranslate } from "./executors/translation-executor";

// Inventory executors
import {
  executeInventoryAdjustStock,
  executeInventorySetParLevels,
  executeInventoryGeneratePurchaseOrder,
} from "./executors/inventory-executors";

// Extended Inventory executors
import {
  executeInventoryAdjustStockExtended,
  executeInventoryGetLowStock,
  executeInventoryGeneratePO,
  executeInventoryGetLevels,
} from "./executors/extended-inventory-executors";

// Order executors
import { executeOrdersMarkServed, executeOrdersComplete } from "./executors/order-executors";

// Extended Order executors
import {
  executeOrderUpdateStatus,
  executeOrdersGetKitchen,
  executeOrdersGetOverdue,
  executeOrdersGetPending,
  executeOrdersGetTodayStats,
} from "./executors/extended-order-executors";

// Analytics executors
import {
  executeAnalyticsGetInsights,
  executeAnalyticsExport,
  executeAnalyticsGetStats,
  executeAnalyticsCreateReport,
} from "./executors/analytics-executors";

// QR Code executors
import {
  executeQRGenerateTable,
  executeQRGenerateBulk,
  executeQRGenerateCounter,
  executeQRList,
  executeQRExportPDF,
} from "./executors/qr-executors";

// Table Management executors
import {
  executeTableGetAvailability,
  executeTableCreate,
  executeTableMerge,
  executeTableGetActiveOrders,
  executeTableGetRevenue,
} from "./executors/table-executors";

// Staff Management executors
import {
  executeStaffList,
  executeStaffInvite,
  executeStaffGetRoles,
  executeStaffGetSchedule,
  executeStaffGetPerformance,
} from "./executors/staff-executors";

// Extended KDS executors
import {
  executeKDSGetStationTickets,
  executeKDSBulkUpdate,
  executeKDSGetOverdueExtended,
  executeKDSGetPrepTimes,
} from "./executors/extended-kds-executors";

// Other executors
import {
  executeDiscountsCreate,
  executeKDSGetOverdue,
  executeKDSSuggestOptimization,
  executeNavigationGoToPage,
} from "./executors/other-executors";

/**
 * Main tool execution router
 * Delegates to specialized executor modules based on tool name
 */
export async function executeTool(
  toolName: ToolName,
  _params: unknown,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  try {
    switch (toolName) {
    // Menu tools
    case "menu.update_prices":
      return executeMenuUpdatePrices(
        _params as Parameters<typeof executeMenuUpdatePrices>[0],
        venueId,
        userId,
        preview
      );

    case "menu.toggle_availability":
      return executeMenuToggleAvailability(
        _params as Parameters<typeof executeMenuToggleAvailability>[0],
        venueId,
        userId,
        preview
      );

    case "menu.create_item":
      return executeMenuCreateItem(
        _params as Parameters<typeof executeMenuCreateItem>[0],
        venueId,
        userId,
        preview
      );

    case "menu.delete_item":
      return executeMenuDeleteItem(
        _params as Parameters<typeof executeMenuDeleteItem>[0],
        venueId,
        userId,
        preview
      );

    case "menu.translate":
      return executeMenuTranslate(_params, venueId, userId, preview);

    // Inventory tools
    case "inventory.adjust_stock":
      return executeInventoryAdjustStock(
        _params as Parameters<typeof executeInventoryAdjustStock>[0],
        venueId,
        userId,
        preview
      );

    case "inventory.set_par_levels":
      return executeInventorySetParLevels(
        _params as Parameters<typeof executeInventorySetParLevels>[0],
        venueId,
        userId,
        preview
      );

    case "inventory.generate_purchase_order":
      return executeInventoryGeneratePurchaseOrder(
        _params as Parameters<typeof executeInventoryGeneratePurchaseOrder>[0],
        venueId,
        userId,
        preview
      );

    // Order tools
    case "orders.mark_served":
      return executeOrdersMarkServed(
        _params as Parameters<typeof executeOrdersMarkServed>[0],
        venueId,
        userId,
        preview
      );

    case "orders.complete":
      return executeOrdersComplete(
        _params as Parameters<typeof executeOrdersComplete>[0],
        venueId,
        userId,
        preview
      );

    // Analytics tools
    case "analytics.get_insights":
      return executeAnalyticsGetInsights(
        _params as Parameters<typeof executeAnalyticsGetInsights>[0],
        venueId,
        userId,
        preview
      );

    case "analytics.get_stats":
      return executeAnalyticsGetStats(
        _params as Parameters<typeof executeAnalyticsGetStats>[0],
        venueId,
        userId,
        preview
      );

    case "analytics.export":
      return executeAnalyticsExport(
        _params as Parameters<typeof executeAnalyticsExport>[0],
        venueId,
        userId,
        preview
      );

    case "analytics.create_report":
      return executeAnalyticsCreateReport(
        _params as Parameters<typeof executeAnalyticsCreateReport>[0],
        venueId,
        userId,
        preview
      );

    // Discount tools
    case "discounts.create":
      return executeDiscountsCreate(
        _params as Parameters<typeof executeDiscountsCreate>[0],
        venueId,
        userId,
        preview
      );

    // KDS tools
    case "kds.get_overdue":
      return executeKDSGetOverdue(
        _params as Parameters<typeof executeKDSGetOverdue>[0],
        venueId,
        userId,
        preview
      );

    case "kds.suggest_optimization":
      return executeKDSSuggestOptimization(
        _params as Parameters<typeof executeKDSSuggestOptimization>[0],
        venueId,
        userId,
        preview
      );

    // Navigation tools
    case "navigation.go_to_page":
      return executeNavigationGoToPage(
        _params as Parameters<typeof executeNavigationGoToPage>[0],
        venueId,
        userId,
        preview
      );

    // QR Code tools
    case "qr.generate_table":
      return executeQRGenerateTable(
        _params as Parameters<typeof executeQRGenerateTable>[0],
        venueId,
        userId,
        preview
      );

    case "qr.generate_bulk":
      return executeQRGenerateBulk(
        _params as Parameters<typeof executeQRGenerateBulk>[0],
        venueId,
        userId,
        preview
      );

    case "qr.generate_counter":
      return executeQRGenerateCounter(
        _params as Parameters<typeof executeQRGenerateCounter>[0],
        venueId,
        userId,
        preview
      );

    case "qr.list_all":
      return executeQRList({}, venueId, userId, preview);

    case "qr.export_pdf":
      return executeQRExportPDF({}, venueId, userId, preview);

    // Extended Menu tools
    case "menu.query_no_images":
      return executeMenuQueryNoImages({}, venueId, userId, preview);

    case "menu.upload_image":
      return executeMenuUploadImage(
        _params as Parameters<typeof executeMenuUploadImage>[0],
        venueId,
        userId,
        preview
      );

    case "menu.translate_extended":
      return executeMenuTranslateExtended(
        _params as Parameters<typeof executeMenuTranslateExtended>[0],
        venueId,
        userId,
        preview
      );

    // Extended Order tools
    case "orders.update_status":
      return executeOrderUpdateStatus(
        _params as Parameters<typeof executeOrderUpdateStatus>[0],
        venueId,
        userId,
        preview
      );

    case "orders.get_kitchen":
      return executeOrdersGetKitchen({}, venueId, userId, preview);

    case "orders.get_overdue":
      return executeOrdersGetOverdue(
        _params as Parameters<typeof executeOrdersGetOverdue>[0],
        venueId,
        userId,
        preview
      );

    case "orders.get_pending":
      return executeOrdersGetPending({}, venueId, userId, preview);

    case "orders.get_today_stats":
      return executeOrdersGetTodayStats({}, venueId, userId, preview);

    // Table Management tools
    case "tables.get_availability":
      return executeTableGetAvailability({}, venueId, userId, preview);

    case "tables.create":
      return executeTableCreate(
        _params as Parameters<typeof executeTableCreate>[0],
        venueId,
        userId,
        preview
      );

    case "tables.merge":
      return executeTableMerge(
        _params as Parameters<typeof executeTableMerge>[0],
        venueId,
        userId,
        preview
      );

    case "tables.get_active_orders":
      return executeTableGetActiveOrders({}, venueId, userId, preview);

    case "tables.get_revenue":
      return executeTableGetRevenue({}, venueId, userId, preview);

    // Staff Management tools
    case "staff.list":
      return executeStaffList({}, venueId, userId, preview);

    case "staff.invite":
      return executeStaffInvite(
        _params as Parameters<typeof executeStaffInvite>[0],
        venueId,
        userId,
        preview
      );

    case "staff.get_roles":
      return executeStaffGetRoles({}, venueId, userId, preview);

    case "staff.get_schedule":
      return executeStaffGetSchedule({}, venueId, userId, preview);

    case "staff.get_performance":
      return executeStaffGetPerformance(
        _params as Parameters<typeof executeStaffGetPerformance>[0],
        venueId,
        userId,
        preview
      );

    // Extended KDS tools
    case "kds.get_station_tickets":
      return executeKDSGetStationTickets(
        _params as Parameters<typeof executeKDSGetStationTickets>[0],
        venueId,
        userId,
        preview
      );

    case "kds.bulk_update":
      return executeKDSBulkUpdate(
        _params as Parameters<typeof executeKDSBulkUpdate>[0],
        venueId,
        userId,
        preview
      );

    case "kds.get_overdue_extended":
      return executeKDSGetOverdueExtended(
        _params as Parameters<typeof executeKDSGetOverdueExtended>[0],
        venueId,
        userId,
        preview
      );

    case "kds.get_prep_times":
      return executeKDSGetPrepTimes({}, venueId, userId, preview);

    // Extended Inventory tools
    case "inventory.adjust_stock_extended":
      return executeInventoryAdjustStockExtended(
        _params as Parameters<typeof executeInventoryAdjustStockExtended>[0],
        venueId,
        userId,
        preview
      );

    case "inventory.get_low_stock":
      return executeInventoryGetLowStock({}, venueId, userId, preview);

    case "inventory.generate_po":
      return executeInventoryGeneratePO({}, venueId, userId, preview);

    case "inventory.get_levels":
      return executeInventoryGetLevels({}, venueId, userId, preview);

    default:
      throw new AIAssistantError(`Tool not implemented: ${toolName}`, "EXECUTION_FAILED");
  }
  } catch (error) {
    // Re-throw AIAssistantError as-is
    if (error instanceof AIAssistantError) {
      throw error;
    }
    // Wrap other errors in AIAssistantError for consistent handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new AIAssistantError(
      `Tool execution failed: ${errorMessage}`,
      "EXECUTION_FAILED",
      { originalError: errorMessage, toolName }
    );
  }
}

// Re-export all executors for direct access if needed
export * from "./executors/menu-executors";
export * from "./executors/translation-executor";
export * from "./executors/inventory-executors";
export * from "./executors/order-executors";
export * from "./executors/analytics-executors";
export * from "./executors/other-executors";
