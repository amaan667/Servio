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
    const items = await menuService.getMenuItems(venueId, { includeUnavailable: true });
    
    if (preview) {
      const before = params.items.map(upd => {
        const item = items.find(i => i.id === upd.id);
        return { id: upd.id, name: item?.name || "Unknown", price: item?.price || 0 };
      });
      const after = params.items.map(upd => {
        const item = items.find(i => i.id === upd.id);
        return { id: upd.id, name: item?.name || "Unknown", price: upd.newPrice };
      });

      return {
        toolName: "menu.update_prices",
        before,
        after,
        impact: { itemsAffected: params.items.length, description: `Updating prices for ${params.items.length} items` },
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
    const items = await menuService.getMenuItems(venueId, { includeUnavailable: true });

    if (preview) {
      const before = params.itemIds.map(id => {
        const item = items.find(i => i.id === id);
        return { id, name: item?.name || "Unknown", available: item?.is_available };
      });
      const after = params.itemIds.map(id => {
        const item = items.find(i => i.id === id);
        return { id, name: item?.name || "Unknown", available: params.available };
      });

      return {
        toolName: "menu.toggle_availability",
        before,
        after,
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
        before: [],
        after: [{ label: params.tableLabel, seats: params.seats || 4 }],
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
    const inventory = await inventoryService.getInventory(venueId);

    if (preview) {
      const before = params.adjustments.map(adj => {
        const item = inventory.find(i => i.id === adj.ingredientId);
        return { id: adj.ingredientId, name: item?.name || "Unknown", onHand: item?.on_hand || 0 };
      });
      const after = params.adjustments.map(adj => {
        const item = inventory.find(i => i.id === adj.ingredientId);
        return { id: adj.ingredientId, name: item?.name || "Unknown", onHand: (item?.on_hand || 0) + adj.delta };
      });

      return {
        toolName: "inventory.adjust_stock",
        before,
        after,
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
