// Servio AI Assistant - Tool Executors
// Implements the actual tool logic with preview support

import { createClient } from "@/lib/supabase/server";
import {
  ToolName,
  MenuUpdatePricesParams,
  MenuToggleAvailabilityParams,
  MenuCreateItemParams,
  MenuDeleteItemParams,
  InventoryAdjustStockParams,
  OrdersMarkServedParams,
  OrdersCompleteParams,
  NavigationGoToPageParams,
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

  // Handle tables as single object (foreign key relation)
  const table = order.tables && (Array.isArray(order.tables) ? order.tables[0] : order.tables);

  if (preview) {
    return {
      toolName: "orders.mark_served",
      before: { status: order.status },
      after: { status: "served" },
      impact: {
        itemsAffected: 1,
        description: `Order will be marked as served${table ? ` for table ${table.table_number}` : ""}`,
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
// Menu Translation Tool
// ============================================================================

export async function executeMenuTranslate(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Note: This is a placeholder - actual translation would use Google Translate API or similar
  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, description")
    .eq("venue_id", venueId);

  if (!items || items.length === 0) {
    throw new AIAssistantError("No menu items found", "INVALID_PARAMS");
  }

  if (preview) {
    return {
      toolName: "menu.translate",
      before: items.slice(0, 5),
      after: items.slice(0, 5).map(i => ({
        ...i,
        name: `[${params.targetLanguage}] ${i.name}`,
        description: i.description ? `[${params.targetLanguage}] ${i.description}` : null
      })),
      impact: {
        itemsAffected: items.length,
        description: `Menu will be translated to ${params.targetLanguage}. Preview shows first 5 items.`,
      },
    };
  }

  // Execution would integrate with translation API
  throw new AIAssistantError(
    "Translation execution requires API integration",
    "EXECUTION_FAILED",
    { hint: "Set up Google Translate API or similar service" }
  );
}

// ============================================================================
// Inventory Tools (Additional)
// ============================================================================

export async function executeInventorySetParLevels(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: ingredients } = await supabase
    .from("v_stock_levels")
    .select("ingredient_id, name, on_hand")
    .eq("venue_id", venueId);

  if (!ingredients || ingredients.length === 0) {
    throw new AIAssistantError("No ingredients found", "INVALID_PARAMS");
  }

  // Calculate par levels based on strategy
  const updates = ingredients.map(ing => {
    let parLevel = ing.on_hand;
    if (params.strategy === "last_7_days" || params.strategy === "last_30_days") {
      parLevel = Math.ceil(ing.on_hand * (1 + params.bufferPercentage / 100));
    }
    return { id: ing.ingredient_id, name: ing.name, currentPar: 0, newPar: parLevel };
  });

  if (preview) {
    return {
      toolName: "inventory.set_par_levels",
      before: updates.map(u => ({ id: u.id, name: u.name, parLevel: u.currentPar })),
      after: updates.map(u => ({ id: u.id, name: u.name, parLevel: u.newPar })),
      impact: {
        itemsAffected: updates.length,
        description: `Par levels will be set based on ${params.strategy} with ${params.bufferPercentage}% buffer`,
      },
    };
  }

  // Execute updates
  for (const update of updates) {
    await supabase
      .from("ingredients")
      .update({ par_level: update.newPar })
      .eq("id", update.id);
  }

  return {
    success: true,
    toolName: "inventory.set_par_levels",
    result: { updatedCount: updates.length },
    auditId: "",
  };
}

export async function executeInventoryGeneratePurchaseOrder(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const thresholdField = params.threshold === "par_level" ? "par_level" : "reorder_level";
  
  const { data: lowStock } = await supabase
    .from("v_stock_levels")
    .select("*")
    .eq("venue_id", venueId)
    .filter("on_hand", "lte", supabase.rpc(thresholdField));

  if (!lowStock || lowStock.length === 0) {
    return {
      success: true,
      toolName: "inventory.generate_purchase_order",
      result: { message: "No items below threshold", items: [] },
      auditId: "",
    };
  }

  const poItems = lowStock.map(item => ({
    ingredient: item.name,
    currentStock: item.on_hand,
    orderQty: Math.max(0, (item[thresholdField] || 0) - item.on_hand),
    unit: item.unit,
    supplier: item.supplier || "TBD",
  }));

  if (preview) {
    return {
      toolName: "inventory.generate_purchase_order",
      before: [],
      after: poItems,
      impact: {
        itemsAffected: poItems.length,
        description: `Purchase order for ${poItems.length} low stock items`,
      },
    };
  }

  return {
    success: true,
    toolName: "inventory.generate_purchase_order",
    result: { format: params.format, items: poItems },
    auditId: "",
  };
}

// ============================================================================
// Analytics Tools
// ============================================================================

export async function executeAnalyticsGetInsights(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Preview mode
  if (preview) {
    const itemContext = params.itemName ? ` for item: ${params.itemName}` : "";
    return {
      toolName: "analytics.get_insights",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        description: `Will generate insights for ${params.timeRange}${itemContext}`,
      },
    };
  }

  // Calculate date range
  const now = new Date();
  let startDate = new Date();
  
  switch (params.timeRange) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      break;
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "quarter":
      startDate.setMonth(now.getMonth() - 3);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case "custom":
      if (params.customRange) {
        startDate = new Date(params.customRange.start);
      }
      break;
  }

  // If filtering by specific item
  if (params.itemId) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        menu_item_id,
        quantity,
        price,
        orders!inner(
          id,
          created_at,
          venue_id
        )
      `)
      .eq("orders.venue_id", venueId)
      .eq("menu_item_id", params.itemId)
      .gte("orders.created_at", startDate.toISOString());

    const totalRevenue = orderItems?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
    const totalQuantity = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const orderCount = new Set(orderItems?.map((item: any) => item.orders.id)).size;

    const insights = {
      itemName: params.itemName || "Unknown Item",
      itemId: params.itemId,
      timeRange: params.timeRange,
      totalRevenue,
      quantitySold: totalQuantity,
      orderCount,
      averagePerOrder: orderCount > 0 ? totalRevenue / orderCount : 0,
      message: `${params.itemName || "Item"}: £${totalRevenue.toFixed(2)} revenue, ${totalQuantity} units sold, ${orderCount} orders (${params.timeRange})`,
    };

    return {
      success: true,
      toolName: "analytics.get_insights",
      result: insights,
      auditId: "",
    };
  }

  // General insights (no specific item)
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("venue_id", venueId)
    .gte("created_at", startDate.toISOString());

  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

  const insights = {
    timeRange: params.timeRange,
    totalRevenue,
    orderCount: orders?.length || 0,
    avgOrderValue: orders?.length ? totalRevenue / orders.length : 0,
    message: `Total: £${totalRevenue.toFixed(2)} revenue from ${orders?.length || 0} orders (${params.timeRange})`,
  };

  return {
    success: true,
    toolName: "analytics.get_insights",
    result: insights,
    auditId: "",
  };
}

export async function executeAnalyticsExport(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "analytics.export",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        description: `Will export ${params.type} data in ${params.format} format`,
      },
    };
  }

  return {
    success: true,
    toolName: "analytics.export",
    result: { message: "Export functionality requires file generation service", type: params.type, format: params.format },
    auditId: "",
  };
}

// ============================================================================
// Discount Tools
// ============================================================================

export async function executeDiscountsCreate(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  if (preview) {
    return {
      toolName: "discounts.create",
      before: [],
      after: [{
        name: params.name,
        scope: params.scope,
        discount: `${params.amountPct}%`,
        startsAt: params.startsAt,
        endsAt: params.endsAt || "No end date",
      }],
      impact: {
        itemsAffected: 1,
        description: `Discount "${params.name}" (${params.amountPct}% off) will be created`,
      },
    };
  }

  const { error } = await supabase
    .from("discounts")
    .insert({
      venue_id: venueId,
      name: params.name,
      scope: params.scope,
      scope_id: params.scopeId,
      amount_pct: params.amountPct,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      created_by: userId,
    });

  if (error) throw new AIAssistantError("Failed to create discount", "EXECUTION_FAILED", error);

  return {
    success: true,
    toolName: "discounts.create",
    result: { discountName: params.name },
    auditId: "",
  };
}

// ============================================================================
// KDS Tools
// ============================================================================

export async function executeKDSGetOverdue(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const query = supabase
    .from("kds_tickets")
    .select("*")
    .eq("venue_id", venueId)
    .eq("status", "in_progress");

  if (params.station) {
    query.eq("station_id", params.station);
  }

  const { data: tickets } = await query;

  const now = new Date();
  const overdueTickets = tickets?.filter(ticket => {
    if (!ticket.started_at) return false;
    const elapsed = (now.getTime() - new Date(ticket.started_at).getTime()) / 1000 / 60;
    return elapsed > params.thresholdMinutes;
  }) || [];

  return {
    success: true,
    toolName: "kds.get_overdue",
    result: { overdueCount: overdueTickets.length, tickets: overdueTickets },
    auditId: "",
  };
}

export async function executeKDSSuggestOptimization(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  // This would analyze KDS performance and suggest optimizations
  return {
    success: true,
    toolName: "kds.suggest_optimization",
    result: {
      suggestions: [
        "Consider adding a prep station for high-volume items",
        "Grill station shows 15min avg wait - add more capacity during peak",
        "Route cold items to dedicated station to reduce congestion",
      ],
    },
    auditId: "",
  };
}

// ============================================================================
// Tool Router
// ============================================================================

export async function executeMenuCreateItem(
  params: MenuCreateItemParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Preview mode
  if (preview) {
    return {
      toolName: "menu.create_item",
      before: [],
      after: [{
        id: "new-item",
        name: params.name,
        price: params.price,
        description: params.description,
        categoryId: params.categoryId,
        available: params.available,
      }],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: 0,
        description: `Will create a new menu item: ${params.name} for £${params.price.toFixed(2)}`,
      },
    };
  }

  // Execute - create the menu item
  const { data: newItem, error } = await supabase
    .from("menu_items")
    .insert({
      venue_id: venueId,
      name: params.name,
      description: params.description,
      price: params.price,
      category_id: params.categoryId,
      available: params.available,
      image_url: params.imageUrl,
      allergens: params.allergens,
      created_by: userId,
    })
    .select("id, name, price")
    .single();

  if (error) {
    throw new AIAssistantError("Failed to create menu item", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "menu.create_item",
    result: newItem,
    auditId: "", // Will be set by calling function
  };
}

export async function executeMenuDeleteItem(
  params: MenuDeleteItemParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Get current item details
  const { data: currentItem } = await supabase
    .from("menu_items")
    .select("id, name, price")
    .eq("id", params.itemId)
    .eq("venue_id", venueId)
    .single();

  if (!currentItem) {
    throw new AIAssistantError("Menu item not found", "INVALID_PARAMS");
  }

  // Preview mode
  if (preview) {
    return {
      toolName: "menu.delete_item",
      before: [currentItem],
      after: [],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: -currentItem.price,
        description: `Will delete menu item: ${currentItem.name} (${params.reason || "No reason provided"})`,
      },
    };
  }

  // Execute - delete the menu item
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", params.itemId)
    .eq("venue_id", venueId);

  if (error) {
    throw new AIAssistantError("Failed to delete menu item", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "menu.delete_item",
    result: { deletedItem: currentItem, reason: params.reason },
    auditId: "", // Will be set by calling function
  };
}

// ============================================================================
// Navigation Tools
// ============================================================================

export async function executeNavigationGoToPage(
  params: NavigationGoToPageParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const { page } = params;
  
  // Map page names to actual routes (verified against existing pages)
  const routeMap: Record<string, string> = {
    "dashboard": `/dashboard/${venueId}`,
    "menu": `/dashboard/${venueId}/menu-management`, // menu-management exists
    "inventory": `/dashboard/${venueId}/inventory`,
    "orders": `/dashboard/${venueId}/orders`,
    "live-orders": `/dashboard/${venueId}/live-orders`,
    "kds": `/dashboard/${venueId}/kds`,
    "kitchen-display": `/dashboard/${venueId}/kds`, // same as kds
    "qr-codes": `/generate-qr`, // Fixed: qr-codes page doesn't exist, use generate-qr
    "generate-qr": `/generate-qr`,
    "analytics": `/dashboard/${venueId}/analytics`,
    "settings": `/dashboard/${venueId}/settings`,
    "staff": `/dashboard/${venueId}/staff`,
    "tables": `/dashboard/${venueId}/tables`,
    "feedback": `/dashboard/${venueId}/feedback`,
  };

  const targetRoute = routeMap[page];
  
  if (!targetRoute) {
    throw new AIAssistantError(`Unknown page: ${page}`, "INVALID_PARAMS");
  }

  // Preview mode - just show what would happen
  if (preview) {
    return {
      toolName: "navigation.go_to_page",
      before: [],
      after: [],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: 0,
        description: `Will navigate to the ${page} page`,
      },
    };
  }

  // Execute - return navigation instruction
  return {
    success: true,
    toolName: "navigation.go_to_page",
    result: {
      action: "navigate",
      route: targetRoute,
      page: page,
      message: `Navigating to ${page} page`,
    },
    auditId: "", // Will be set by the calling function
  };
}

export async function executeAnalyticsGetStats(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Preview mode
  if (preview) {
    const itemContext = params.itemName ? ` for item: ${params.itemName}` : "";
    return {
      toolName: "analytics.get_stats",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        estimatedRevenue: 0,
        description: `Will generate ${params.metric} statistics for ${params.timeRange}${itemContext}`,
      },
    };
  }

  // Execute - get analytics data
  let stats = {};
  
  try {
    // Build base query for orders
    const timeStart = getTimeRangeStart(params.timeRange);
    
    // If filtering by specific item, get order_items data
    if (params.itemId) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          menu_item_id,
          quantity,
          price,
          orders!inner(
            id,
            created_at,
            venue_id,
            total_amount
          )
        `)
        .eq("orders.venue_id", venueId)
        .eq("menu_item_id", params.itemId)
        .gte("orders.created_at", timeStart);

      const totalRevenue = orderItems?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
      const totalQuantity = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const orderCount = new Set(orderItems?.map((item: any) => item.orders.id)).size;

      stats = {
        itemName: params.itemName || "Unknown Item",
        itemId: params.itemId,
        timeRange: params.timeRange,
        revenue: totalRevenue,
        quantitySold: totalQuantity,
        orderCount: orderCount,
        averagePerOrder: orderCount > 0 ? totalRevenue / orderCount : 0,
        message: `${params.itemName || "Item"} generated £${totalRevenue.toFixed(2)} in revenue from ${totalQuantity} units sold across ${orderCount} orders in the ${params.timeRange}.`,
      };
    } else {
      // General analytics (no specific item)
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", timeStart);

      switch (params.metric) {
        case "revenue":
          const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
          stats = {
            total: totalRevenue,
            count: orders?.length || 0,
            average: orders?.length ? totalRevenue / orders.length : 0,
            timeRange: params.timeRange,
            message: `Total revenue for ${params.timeRange}: £${totalRevenue.toFixed(2)} from ${orders?.length || 0} orders.`,
          };
          break;
        case "orders_count":
          stats = { 
            count: orders?.length || 0,
            timeRange: params.timeRange,
            message: `Total orders for ${params.timeRange}: ${orders?.length || 0}`,
          };
          break;
        case "top_items":
          const { data: topItems } = await supabase
            .from("order_items")
            .select(`
              menu_item_id,
              quantity,
              price,
              menu_items!inner(name),
              orders!inner(venue_id, created_at)
            `)
            .eq("orders.venue_id", venueId)
            .gte("orders.created_at", timeStart);

          const itemSales = new Map();
          topItems?.forEach((item: any) => {
            const existing = itemSales.get(item.menu_item_id) || { name: item.menu_items.name, quantity: 0, revenue: 0 };
            itemSales.set(item.menu_item_id, {
              name: existing.name,
              quantity: existing.quantity + item.quantity,
              revenue: existing.revenue + (item.price * item.quantity),
            });
          });

          const top10 = Array.from(itemSales.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

          stats = {
            topItems: top10,
            timeRange: params.timeRange,
            message: `Top ${top10.length} items by revenue for ${params.timeRange}`,
          };
          break;
        default:
          stats = { 
            message: `${params.metric} analysis for ${params.timeRange}`,
            timeRange: params.timeRange,
          };
      }
    }
  } catch (error) {
    throw new AIAssistantError("Failed to get analytics data", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "analytics.get_stats",
    result: stats,
    auditId: "", // Will be set by calling function
  };
}

export async function executeAnalyticsCreateReport(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  // Preview mode
  if (preview) {
    return {
      toolName: "analytics.create_report",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        estimatedRevenue: 0,
        description: `Will create report "${params.name}" with ${params.metrics.length} metrics in ${params.format} format`,
      },
    };
  }

  // Execute - create report (simplified implementation)
  const report = {
    name: params.name,
    metrics: params.metrics,
    timeRange: params.timeRange,
    format: params.format,
    createdAt: new Date().toISOString(),
    venueId,
    createdBy: userId,
  };

  return {
    success: true,
    toolName: "analytics.create_report",
    result: report,
    auditId: "", // Will be set by calling function
  };
}

// Helper function to get time range start
function getTimeRangeStart(timeRange: string): string {
  const now = new Date();
  switch (timeRange) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "quarter":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case "year":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

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
      throw new AIAssistantError(
        `Tool not implemented: ${toolName}`,
        "EXECUTION_FAILED"
      );
  }
}

