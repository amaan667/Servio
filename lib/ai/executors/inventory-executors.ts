import { createClient } from "@/lib/supabase";
import {
  InventoryAdjustStockParams,
  AIPreviewDiff,
  AIExecutionResult,
  AIAssistantError,
} from "@/types/ai-assistant";

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

export async function executeInventorySetParLevels(
  params: unknown,
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
  params: unknown,
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

