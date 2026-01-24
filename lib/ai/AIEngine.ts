/**
 * Unified AI Engine
 * Consolidates all AI executors into a single cohesive service
 */

import { 
  AIExecutionResult, 
  AIPreviewDiff, 
  AIAssistantError
} from "@/types/ai-assistant";
import { orderService } from "@/lib/services/OrderService";
import { menuService } from "@/lib/services/MenuService";
import { tableService } from "@/lib/services/TableService";
import { inventoryService } from "@/lib/services/InventoryService";

export class AIEngine {
  /**
   * ORDERS
   */
  async executeOrdersMarkServed(params: { orderId: string }, venueId: string, _userId: string, preview: boolean): Promise<AIPreviewDiff | AIExecutionResult> {
    const order = await orderService.getOrder(params.orderId, venueId);
    if (!order) throw new AIAssistantError("Order not found", "INVALID_PARAMS");

    if (preview) {
      return {
        toolName: "orders.mark_served",
        before: { status: order.order_status },
        after: { status: "SERVED" },
        impact: { itemsAffected: 1, description: `Order will be marked as served` },
      };
    }

    await orderService.markServed(params.orderId, venueId);
    return { 
      success: true, 
      toolName: "orders.mark_served" as const, 
      result: { orderId: params.orderId }, 
      auditId: "" 
    };
  }

  async executeOrdersComplete(params: { orderId: string }, venueId: string, _userId: string, preview: boolean): Promise<AIPreviewDiff | AIExecutionResult> {
    const order = await orderService.getOrder(params.orderId, venueId);
    if (!order) throw new AIAssistantError("Order not found", "INVALID_PARAMS");

    if (preview) {
      return {
        toolName: "orders.complete",
        before: { status: order.order_status },
        after: { status: "COMPLETED" },
        impact: { itemsAffected: 1, description: `Order will be completed` },
      };
    }

    await orderService.completeOrder(params.orderId, venueId);
    return { 
      success: true, 
      toolName: "orders.complete" as const, 
      result: { orderId: params.orderId }, 
      auditId: "" 
    };
  }

  /**
   * MENU
   */
  async executeMenuUpdatePrices(params: { items: { id: string; newPrice: number }[] }, venueId: string, _userId: string, preview: boolean): Promise<AIPreviewDiff | AIExecutionResult> {
    if (preview) {
      const impact = params.items.length;
      return {
        toolName: "menu.update_prices",
        impact: { itemsAffected: impact, description: `Updating prices for ${impact} items` },
      };
    }

    await menuService.bulkUpdatePrices(venueId, params.items.map(i => ({ id: i.id, price: i.newPrice })));
    return { 
      success: true, 
      toolName: "menu.update_prices" as const, 
      result: { updatedCount: params.items.length }, 
      auditId: "" 
    };
  }

  async executeMenuToggleAvailability(params: { itemIds: string[], available: boolean }, venueId: string, _userId: string, preview: boolean): Promise<AIPreviewDiff | AIExecutionResult> {
    if (preview) {
      return {
        toolName: "menu.toggle_availability",
        impact: { itemsAffected: params.itemIds.length, description: `Toggling availability for ${params.itemIds.length} items` },
      };
    }

    for (const id of params.itemIds) {
      await menuService.toggleAvailability(id, venueId, params.available);
    }
    return { 
      success: true, 
      toolName: "menu.toggle_availability" as const, 
      result: { updatedCount: params.itemIds.length }, 
      auditId: "" 
    };
  }

  /**
   * TABLES
   */
  async executeTableCreate(params: { tableLabel: string; seats?: number }, venueId: string, _userId: string, preview: boolean): Promise<AIPreviewDiff | AIExecutionResult> {
    if (preview) {
      return {
        toolName: "tables.create",
        impact: { itemsAffected: 1, description: `Will create table ${params.tableLabel}` },
      };
    }

    const table = await tableService.createTable(venueId, {
      table_number: 0, 
      label: params.tableLabel,
      seat_count: params.seats || 4,
    });
    return { 
      success: true, 
      toolName: "tables.create" as const, 
      result: { table }, 
      auditId: "" 
    };
  }

  /**
   * INVENTORY
   */
  async executeInventoryAdjustStock(params: { adjustments: { ingredientId: string; delta: number }[], reason: string }, venueId: string, userId: string, preview: boolean): Promise<AIPreviewDiff | AIExecutionResult> {
    if (preview) {
      return {
        toolName: "inventory.adjust_stock",
        impact: { itemsAffected: params.adjustments.length, description: `Adjusting stock for ${params.adjustments.length} items` },
      };
    }

    for (const adj of params.adjustments) {
      await inventoryService.adjustStock(venueId, adj.ingredientId, adj.delta, params.reason, userId);
    }
    return { 
      success: true, 
      toolName: "inventory.adjust_stock" as const, 
      result: { adjustedCount: params.adjustments.length }, 
      auditId: "" 
    };
  }
}

export const aiEngine = new AIEngine();
