// Servio AI Assistant - Extended Inventory Executors

import { AIExecutionResult, AIPreviewDiff } from "@/types/ai-assistant";
import {
  adjustInventoryStock,
  getLowStockItems,
  generatePurchaseOrder,
  getInventoryLevels,
} from "../tools/extended-inventory-tools";

/**
 * Execute inventory stock adjustment
 */
export async function executeInventoryAdjustStockExtended(
  params: { itemName: string; adjustment: number; reason?: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "inventory.adjust_stock_extended",
      before: [{ itemName: params.itemName, adjustment: 0 }],
      after: [{ itemName: params.itemName, adjustment: params.adjustment }],
      impact: {
        itemsAffected: 1,
        description: `Will ${params.adjustment > 0 ? "add" : "remove"} ${Math.abs(params.adjustment)} units ${params.adjustment > 0 ? "to" : "from"} ${params.itemName}`,
      },
    };
  }

  const result = await adjustInventoryStock(
    venueId,
    params.itemName,
    params.adjustment,
    params.reason
  );

  return {
    success: true,
    toolName: "inventory.adjust_stock_extended",
    result: {
      itemId: result.itemId,
      itemName: result.itemName,
      oldQuantity: result.oldQuantity,
      newQuantity: result.newQuantity,
      adjustment: result.adjustment,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute low stock query
 */
export async function executeInventoryGetLowStock(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getLowStockItems(venueId);

  return {
    success: true,
    toolName: "inventory.get_low_stock",
    result: {
      items: result.items,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute purchase order generation
 */
export async function executeInventoryGeneratePO(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await generatePurchaseOrder(venueId);

  return {
    success: true,
    toolName: "inventory.generate_po",
    result: {
      items: result.items,
      totalItems: result.totalItems,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute inventory levels query
 */
export async function executeInventoryGetLevels(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getInventoryLevels(venueId);

  return {
    success: true,
    toolName: "inventory.get_levels",
    result: {
      total: result.total,
      lowStock: result.lowStock,
      outOfStock: result.outOfStock,
      summary: result.summary,
    },
    auditId: "",
  };
}
