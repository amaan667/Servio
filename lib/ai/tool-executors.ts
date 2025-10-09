// Servio AI Assistant - Tool Executors
// Implements the actual tool logic with preview support

import { createClient } from "@/lib/supabase/server";
import {
  ToolName,
  MenuUpdatePricesParams,
  MenuToggleAvailabilityParams,
  InventoryAdjustStockParams,
  OrdersMarkServedParams,
  OrdersCompleteParams,
  AIPreviewDiff,
  AIExecutionResult,
  AIAssistantError,
  DEFAULT_GUARDRAILS,
} from "@/types/ai-assistant";

// ============================================================================
// Menu Tools
// ============================================================================

export async function executeMenuUpdatePrices(
  params: MenuUpdatePricesParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Validate guardrails
  const { data: currentItems } = await supabase
    .from("menu_items")
    .select("id, name, price")
    .eq("venue_id", venueId)
    .in(
      "id",
      params.items.map((i) => i.id)
    );

  if (!currentItems || currentItems.length === 0) {
    throw new AIAssistantError("No items found", "INVALID_PARAMS");
  }

  // Check price change guardrail (±20%)
  const maxChangePercent = DEFAULT_GUARDRAILS["menu.update_prices"].maxPriceChangePercent || 20;
  
  for (const item of params.items) {
    const current = currentItems.find((i) => i.id === item.id);
    if (!current) continue;

    const changePercent = Math.abs(((item.newPrice - current.price) / current.price) * 100);
    if (changePercent > maxChangePercent) {
      throw new AIAssistantError(
        `Price change of ${changePercent.toFixed(1)}% exceeds limit of ${maxChangePercent}%`,
        "GUARDRAIL_VIOLATION",
        { itemId: item.id, itemName: current.name }
      );
    }
  }

  // Preview mode
  if (preview) {
    const before = currentItems.map((i) => ({ id: i.id, name: i.name, price: i.price }));
    const after = currentItems.map((i) => {
      const update = params.items.find((u) => u.id === i.id);
      return {
        id: i.id,
        name: i.name,
        price: update ? update.newPrice : i.price,
      };
    });

    const oldRevenue = before.reduce((sum, i) => sum + i.price, 0);
    const newRevenue = after.reduce((sum, i) => sum + i.price, 0);

    return {
      toolName: "menu.update_prices",
      before,
      after,
      impact: {
        itemsAffected: params.items.length,
        estimatedRevenue: newRevenue - oldRevenue,
        description: `${params.items.length} items will be updated. Estimated revenue impact: ${((newRevenue - oldRevenue) / oldRevenue * 100).toFixed(1)}%`,
      },
    };
  }

  // Execute
  const updates = params.items.map((item) => ({
    id: item.id,
    price: item.newPrice,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("menu_items")
    .upsert(updates);

  if (error) {
    throw new AIAssistantError("Failed to update prices", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "menu.update_prices",
    result: { updatedCount: params.items.length },
    auditId: "", // Will be set by caller
  };
}

export async function executeMenuToggleAvailability(
  params: MenuToggleAvailabilityParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, available")
    .eq("venue_id", venueId)
    .in("id", params.itemIds);

  if (!items || items.length === 0) {
    throw new AIAssistantError("No items found", "INVALID_PARAMS");
  }

  if (preview) {
    return {
      toolName: "menu.toggle_availability",
      before: items,
      after: items.map((i) => ({ ...i, available: params.available })),
      impact: {
        itemsAffected: items.length,
        description: `${items.length} items will be ${params.available ? "shown" : "hidden"}${params.reason ? `: ${params.reason}` : ""}`,
      },
    };
  }

  const { error } = await supabase
    .from("menu_items")
    .update({ available: params.available, updated_at: new Date().toISOString() })
    .in("id", params.itemIds);

  if (error) {
    throw new AIAssistantError("Failed to toggle availability", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "menu.toggle_availability",
    result: { updatedCount: params.itemIds.length },
    auditId: "",
  };
}

// ============================================================================
// Inventory Tools
// ============================================================================

export async function executeInventoryAdjustStock(
  params: InventoryAdjustStockParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const ingredientIds = params.adjustments.map((a) => a.ingredientId);
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("id, name, on_hand, unit")
    .eq("venue_id", venueId)
    .in("id", ingredientIds);

  if (!ingredients || ingredients.length === 0) {
    throw new AIAssistantError("No ingredients found", "INVALID_PARAMS");
  }

  if (preview) {
    const before = ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      onHand: i.on_hand,
      unit: i.unit,
    }));

    const after = ingredients.map((i) => {
      const adjustment = params.adjustments.find((a) => a.ingredientId === i.id);
      return {
        id: i.id,
        name: i.name,
        onHand: adjustment ? i.on_hand + adjustment.delta : i.on_hand,
        unit: i.unit,
      };
    });

    return {
      toolName: "inventory.adjust_stock",
      before,
      after,
      impact: {
        itemsAffected: params.adjustments.length,
        description: `Stock levels will be adjusted for ${params.adjustments.length} ingredients (${params.reason})`,
      },
    };
  }

  // Execute adjustments
  const ledgerEntries = params.adjustments.map((adj) => ({
    venue_id: venueId,
    ingredient_id: adj.ingredientId,
    change_type: params.reason,
    quantity_change: adj.delta,
    notes: adj.notes || `AI Assistant: ${params.reason}`,
    created_by: userId,
  }));

  const { error: ledgerError } = await supabase
    .from("stock_ledgers")
    .insert(ledgerEntries);

  if (ledgerError) {
    throw new AIAssistantError("Failed to create stock ledger entries", "EXECUTION_FAILED", ledgerError);
  }

  // Update on_hand quantities
  for (const adj of params.adjustments) {
    const { error } = await supabase.rpc("adjust_stock", {
      p_ingredient_id: adj.ingredientId,
      p_delta: adj.delta,
    });

    if (error) {
      throw new AIAssistantError("Failed to adjust stock", "EXECUTION_FAILED", error);
    }
  }

  return {
    success: true,
    toolName: "inventory.adjust_stock",
    result: { adjustedCount: params.adjustments.length },
    auditId: "",
  };
}

// ============================================================================
// Order Tools
// ============================================================================

export async function executeOrdersMarkServed(
  params: OrdersMarkServedParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, table_id, tables(table_number)")
    .eq("id", params.orderId)
    .eq("venue_id", venueId)
    .single();

  if (!order) {
    throw new AIAssistantError("Order not found", "INVALID_PARAMS");
  }

  if (order.status !== "ready") {
    throw new AIAssistantError(
      `Order must be in 'ready' status to mark as served (current: ${order.status})`,
      "INVALID_PARAMS"
    );
  }

  if (preview) {
    return {
      toolName: "orders.mark_served",
      before: { status: order.status },
      after: { status: "served" },
      impact: {
        itemsAffected: 1,
        description: `Order will be marked as served${order.tables ? ` for table ${order.tables.table_number}` : ""}`,
      },
    };
  }

  // Mark as served
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: "served",
      served_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.orderId);

  if (orderError) {
    throw new AIAssistantError("Failed to mark order as served", "EXECUTION_FAILED", orderError);
  }

  // Optionally notify FOH (via realtime or notification system)
  if (params.notifyFOH) {
    // TODO: Implement FOH notification
  }

  return {
    success: true,
    toolName: "orders.mark_served",
    result: { orderId: params.orderId },
    auditId: "",
  };
}

export async function executeOrdersComplete(
  params: OrdersCompleteParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, total_amount")
    .eq("id", params.orderId)
    .eq("venue_id", venueId)
    .single();

  if (!order) {
    throw new AIAssistantError("Order not found", "INVALID_PARAMS");
  }

  if (order.status === "completed") {
    throw new AIAssistantError("Order is already completed", "INVALID_PARAMS");
  }

  if (preview) {
    return {
      toolName: "orders.complete",
      before: { status: order.status },
      after: { status: "completed" },
      impact: {
        itemsAffected: 1,
        estimatedRevenue: order.total_amount,
        description: `Order will be completed. Revenue: £${order.total_amount.toFixed(2)}`,
      },
    };
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.orderId);

  if (error) {
    throw new AIAssistantError("Failed to complete order", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "orders.complete",
    result: { orderId: params.orderId, revenue: order.total_amount },
    auditId: "",
  };
}

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
    
    case "inventory.adjust_stock":
      return executeInventoryAdjustStock(params, venueId, userId, preview);
    
    case "orders.mark_served":
      return executeOrdersMarkServed(params, venueId, userId, preview);
    
    case "orders.complete":
      return executeOrdersComplete(params, venueId, userId, preview);
    
    // Add other tools here...
    
    default:
      throw new AIAssistantError(
        `Tool not implemented: ${toolName}`,
        "EXECUTION_FAILED"
      );
  }
}

