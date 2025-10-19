// Tool Executors - Main router and barrel exports
// Extracted from tool-executors.ts

import { ToolName, AIPreviewDiff, AIExecutionResult } from "@/types/ai-assistant";

// Menu Tools
export {
  executeMenuUpdatePrices,
  executeMenuToggleAvailability,
  executeMenuCreateItem,
  executeMenuDeleteItem,
  executeMenuTranslate,
} from "./menu";

// Pricing Tools
export {
  executeDiscountsCreate,
} from "./pricing";

// Analytics Tools
export {
  executeAnalyticsGetInsights,
  executeAnalyticsExport,
  executeAnalyticsGetStats,
  executeAnalyticsCreateReport,
} from "./analytics";

// Order Tools
export {
  executeOrdersMarkServed,
  executeOrdersComplete,
} from "./orders";

// Inventory Tools
export {
  executeInventoryAdjustStock,
  executeInventorySetParLevels,
  executeInventoryGeneratePurchaseOrder,
} from "./inventory";

// KDS Tools
export {
  executeKDSGetOverdue,
  executeKDSSuggestOptimization,
} from "./kds";

// Navigation Tools
export {
  executeNavigationGoToPage,
} from "./navigation";

// Import all executors for the router
import { executeMenuUpdatePrices } from "./menu";
import { executeMenuToggleAvailability } from "./menu";
import { executeMenuCreateItem } from "./menu";
import { executeMenuDeleteItem } from "./menu";
import { executeMenuTranslate } from "./menu";
import { executeInventoryAdjustStock } from "./inventory";
import { executeInventorySetParLevels } from "./inventory";
import { executeInventoryGeneratePurchaseOrder } from "./inventory";
import { executeOrdersMarkServed } from "./orders";
import { executeOrdersComplete } from "./orders";
import { executeAnalyticsGetInsights } from "./analytics";
import { executeAnalyticsGetStats } from "./analytics";
import { executeAnalyticsExport } from "./analytics";
import { executeAnalyticsCreateReport } from "./analytics";
import { executeDiscountsCreate } from "./pricing";
import { executeKDSGetOverdue } from "./kds";
import { executeKDSSuggestOptimization } from "./kds";
import { executeNavigationGoToPage } from "./navigation";

// ============================================================================
// Tool Router
// ============================================================================

export async function executeTool(
  toolName: ToolName,
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  switch (toolName) {
    case "menu.update_prices":
      return executeMenuUpdatePrices(params, venueId, userId, preview);
    
    case "menu.toggle_availability":
      return executeMenuToggleAvailability(params, venueId, userId, preview);
    
    case "menu.create_item":
      return executeMenuCreateItem(params, venueId, userId, preview);
    
    case "menu.delete_item":
      return executeMenuDeleteItem(params, venueId, userId, preview);
    
    case "menu.translate":
      return executeMenuTranslate(params, venueId, userId, preview);
    
    case "inventory.adjust_stock":
      return executeInventoryAdjustStock(params, venueId, userId, preview);
    
    case "inventory.set_par_levels":
      return executeInventorySetParLevels(params, venueId, userId, preview);
    
    case "inventory.generate_purchase_order":
      return executeInventoryGeneratePurchaseOrder(params, venueId, userId, preview);
    
    case "orders.mark_served":
      return executeOrdersMarkServed(params, venueId, userId, preview);
    
    case "orders.complete":
      return executeOrdersComplete(params, venueId, userId, preview);
    
    case "analytics.get_insights":
      return executeAnalyticsGetInsights(params, venueId, userId, preview);
    
    case "analytics.get_stats":
      return executeAnalyticsGetStats(params, venueId, userId, preview);
    
    case "analytics.export":
      return executeAnalyticsExport(params, venueId, userId, preview);
    
    case "analytics.create_report":
      return executeAnalyticsCreateReport(params, venueId, userId, preview);
    
    case "discounts.create":
      return executeDiscountsCreate(params, venueId, userId, preview);
    
    case "kds.get_overdue":
      return executeKDSGetOverdue(params, venueId, userId, preview);
    
    case "kds.suggest_optimization":
      return executeKDSSuggestOptimization(params, venueId, userId, preview);
    
    case "navigation.go_to_page":
      return executeNavigationGoToPage(params, venueId, userId, preview);
    
    default:
      throw new Error(
        `Tool not implemented: ${toolName}`
      );
  }
}

