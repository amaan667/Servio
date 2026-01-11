import { createClient } from "@/lib/supabase";
import {
  InventoryAdjustStockParams,
  AIPreviewDiff,
  AIExecutionResult,
  AIAssistantError,
} from "@/types/ai-assistant";

export async function executeInventoryAdjustStock(

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

    }));

    const after = ingredients.map((i) => {
      const adjustment = params.adjustments.find((a) => a.ingredientId === i.id);
      return {

      };

    return {

      before,
      after,

        description: `Stock levels will be adjusted for ${params.adjustments.length} ingredients (${params.reason})`,
      },
    };
  }

  const ledgerEntries = params.adjustments.map((adj) => ({

    notes: adj.notes || `AI Assistant: ${params.reason}`,

  }));

  const { error: ledgerError } = await supabase.from("stock_ledgers").insert(ledgerEntries);

  if (ledgerError) {
    throw new AIAssistantError("Failed to create stock ledger entries", "EXECUTION_FAILED", {

  }

  for (const adj of params.adjustments) {
    const { error } = await supabase.rpc("adjust_stock", {

    if (error) {
      throw new AIAssistantError("Failed to adjust stock", "EXECUTION_FAILED", { error });
    }
  }

  return {

    result: { adjustedCount: params.adjustments.length },

  };
}

export async function executeInventorySetParLevels(

  const typedParams = _params as { strategy: string; bufferPercentage: number };
  const supabase = await createClient();

  const { data: ingredients } = await supabase
    .from("v_stock_levels")
    .select("ingredient_id, name, on_hand")
    .eq("venue_id", venueId);

  if (!ingredients || ingredients.length === 0) {
    throw new AIAssistantError("No ingredients found", "INVALID_PARAMS");
  }

  const updates = ingredients.map((ing) => {
    let parLevel = ing.on_hand;
    if (typedParams.strategy === "last_7_days" || typedParams.strategy === "last_30_days") {
      parLevel = Math.ceil(ing.on_hand * (1 + typedParams.bufferPercentage / 100));
    }
    return { id: ing.ingredient_id, name: ing.name, currentPar: 0, newPar: parLevel };

  if (preview) {
    return {

      before: updates.map((u) => ({ id: u.id, name: u.name, parLevel: u.currentPar })),
      after: updates.map((u) => ({ id: u.id, name: u.name, parLevel: u.newPar })),

        description: `Par levels will be set based on ${typedParams.strategy} with ${typedParams.bufferPercentage}% buffer`,
      },
    };
  }

  for (const update of updates) {
    await supabase.from("ingredients").update({ par_level: update.newPar }).eq("id", update.id);
  }

  return {

    result: { updatedCount: updates.length },

  };
}

export async function executeInventoryGeneratePurchaseOrder(

  const typedParams = _params as { threshold: string; format: string };
  const supabase = await createClient();

  const thresholdField = typedParams.threshold === "par_level" ? "par_level" : "reorder_level";

  const { data: lowStock } = await supabase
    .from("v_stock_levels")
    .select("*")
    .eq("venue_id", venueId)
    .filter("on_hand", "lte", supabase.rpc(thresholdField));

  if (!lowStock || lowStock.length === 0) {
    return {

      result: { message: "No items below threshold", items: [] },

    };
  }

  const poItems = lowStock.map((item) => ({

    orderQty: Math.max(0, (item[thresholdField] || 0) - item.on_hand),

  }));

  if (preview) {
    return {

        description: `Purchase order for ${poItems.length} low stock items`,
      },
    };
  }

  return {

    result: { format: typedParams.format, items: poItems },

  };
}
