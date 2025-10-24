// Servio AI Assistant - Tool Executors
// Main router that delegates to specialized executor modules

import {
  ToolName,
  AIPreviewDiff,
  AIExecutionResult,
  AIAssistantError,
} from "@/types/ai-assistant";

// Menu executors
import {
  executeMenuUpdatePrices,
  executeMenuToggleAvailability,
  executeMenuCreateItem,
  executeMenuDeleteItem,
} from "./executors/menu-executors";

// Translation executor
import { executeMenuTranslate } from "./executors/translation-executor";

// Inventory executors
import {
  executeInventoryAdjustStock,
  executeInventorySetParLevels,
  executeInventoryGeneratePurchaseOrder,
} from "./executors/inventory-executors";

// Order executors
import {
  executeOrdersMarkServed,
  executeOrdersComplete,
} from "./executors/order-executors";

// Analytics executors
import {
  executeAnalyticsGetInsights,
  executeAnalyticsExport,
  executeAnalyticsGetStats,
  executeAnalyticsCreateReport,
} from "./executors/analytics-executors";

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
  switch (toolName) {
    // Menu tools
    case "menu.update_prices":
      return executeMenuUpdatePrices(params as Parameters<typeof executeMenuUpdatePrices>[0], venueId, userId, preview);
    
    case "menu.toggle_availability":
      return executeMenuToggleAvailability(params as Parameters<typeof executeMenuToggleAvailability>[0], venueId, userId, preview);
    
    case "menu.create_item":
      return executeMenuCreateItem(params as Parameters<typeof executeMenuCreateItem>[0], venueId, userId, preview);
    
    case "menu.delete_item":
      return executeMenuDeleteItem(params as Parameters<typeof executeMenuDeleteItem>[0], venueId, userId, preview);
    
    case "menu.translate":
      return executeMenuTranslate(params, venueId, userId, preview);
    
    // Inventory tools
    case "inventory.adjust_stock":
      return executeInventoryAdjustStock(params as Parameters<typeof executeInventoryAdjustStock>[0], venueId, userId, preview);
    
    case "inventory.set_par_levels":
      return executeInventorySetParLevels(params as Parameters<typeof executeInventorySetParLevels>[0], venueId, userId, preview);
    
    case "inventory.generate_purchase_order":
      return executeInventoryGeneratePurchaseOrder(params as Parameters<typeof executeInventoryGeneratePurchaseOrder>[0], venueId, userId, preview);
    
    // Order tools
    case "orders.mark_served":
      return executeOrdersMarkServed(params as Parameters<typeof executeOrdersMarkServed>[0], venueId, userId, preview);
    
    case "orders.complete":
      return executeOrdersComplete(params as Parameters<typeof executeOrdersComplete>[0], venueId, userId, preview);
    
    // Analytics tools
    case "analytics.get_insights":
      return executeAnalyticsGetInsights(params as Parameters<typeof executeAnalyticsGetInsights>[0], venueId, userId, preview);
    
    case "analytics.get_stats":
      return executeAnalyticsGetStats(params as Parameters<typeof executeAnalyticsGetStats>[0], venueId, userId, preview);
    
    case "analytics.export":
      return executeAnalyticsExport(params as Parameters<typeof executeAnalyticsExport>[0], venueId, userId, preview);
    
    case "analytics.create_report":
      return executeAnalyticsCreateReport(params as Parameters<typeof executeAnalyticsCreateReport>[0], venueId, userId, preview);
    
    // Discount tools
    case "discounts.create":
      return executeDiscountsCreate(params as Parameters<typeof executeDiscountsCreate>[0], venueId, userId, preview);
    
    // KDS tools
    case "kds.get_overdue":
      return executeKDSGetOverdue(params as Parameters<typeof executeKDSGetOverdue>[0], venueId, userId, preview);
    
    case "kds.suggest_optimization":
      return executeKDSSuggestOptimization(params as Parameters<typeof executeKDSSuggestOptimization>[0], venueId, userId, preview);
    
    // Navigation tools
    case "navigation.go_to_page":
      return executeNavigationGoToPage(params as Parameters<typeof executeNavigationGoToPage>[0], venueId, userId, preview);
    
    default:
      throw new AIAssistantError(
        `Tool not implemented: ${toolName}`,
        "EXECUTION_FAILED"
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
