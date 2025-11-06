// Servio AI Assistant - Extended Inventory Tools
// Stock adjustments and inventory management

import { createClient } from "@/lib/supabase";
import { aiLogger } from "@/lib/logger";

interface StockAdjustmentResult {
  success: boolean;
  itemId: string;
  itemName: string;
  oldQuantity: number;
  newQuantity: number;
  adjustment: number;
  message: string;
}

interface LowStockResult {
  items: Array<{
    id: string;
    name: string;
    category: string;
    currentStock: number;
    parLevel: number;
    needToOrder: number;
  }>;
  count: number;
  summary: string;
}

/**
 * Adjust inventory stock levels
 */
export async function adjustInventoryStock(
  venueId: string,
  itemName: string,
  adjustment: number,
  reason?: string
): Promise<StockAdjustmentResult> {
  const supabase = await createClient();

  aiLogger.info(
    `[AI INVENTORY] Adjusting stock for ${itemName}: ${adjustment > 0 ? "+" : ""}${adjustment}`
  );

  // Find inventory item
  const { data: item, error: fetchError } = await supabase
    .from("inventory")
    .select("id, name, quantity, unit")
    .eq("venue_id", venueId)
    .ilike("name", `%${itemName}%`)
    .maybeSingle();

  if (fetchError) {
    aiLogger.error("[AI INVENTORY] Error fetching item:", fetchError);
    throw new Error(`Failed to fetch inventory item: ${fetchError.message}`);
  }

  if (!item) {
    throw new Error(`Inventory item "${itemName}" not found. Please check the name and try again.`);
  }

  const oldQuantity = item.quantity || 0;
  const newQuantity = Math.max(0, oldQuantity + adjustment);

  // Update stock
  const { error: updateError } = await supabase
    .from("inventory")
    .update({
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  if (updateError) {
    aiLogger.error("[AI INVENTORY] Error updating stock:", updateError);
    throw new Error(`Failed to update stock: ${updateError.message}`);
  }

  // Log adjustment in history if table exists
  try {
    await supabase.from("inventory_adjustments").insert({
      inventory_id: item.id,
      venue_id: venueId,
      adjustment,
      reason: reason || "AI Assistant adjustment",
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Ignore if table doesn't exist
  }

  return {
    success: true,
    itemId: item.id,
    itemName: item.name,
    oldQuantity,
    newQuantity,
    adjustment,
    message: `Updated ${item.name}: ${oldQuantity} → ${newQuantity} ${item.unit || "units"} (${adjustment > 0 ? "+" : ""}${adjustment}).${reason ? ` Reason: ${reason}` : ""}`,
  };
}

/**
 * Get items that are low in stock
 */
export async function getLowStockItems(venueId: string): Promise<LowStockResult> {
  const supabase = await createClient();

  aiLogger.info(`[AI INVENTORY] Fetching low stock items for venue: ${venueId}`);

  const { data: items, error } = await supabase
    .from("inventory")
    .select("id, name, category, quantity, par_level, unit")
    .eq("venue_id", venueId)
    .order("quantity", { ascending: true });

  if (error) {
    aiLogger.error("[AI INVENTORY] Error fetching inventory:", error);
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  const lowStockItems =
    items
      ?.filter((item) => {
        const quantity = item.quantity || 0;
        const parLevel = item.par_level || quantity * 2;
        return quantity < parLevel;
      })
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category || "Uncategorized",
        currentStock: item.quantity || 0,
        parLevel: item.par_level || 0,
        needToOrder: Math.max(0, (item.par_level || 0) - (item.quantity || 0)),
      })) || [];

  // Sort by urgency (lowest stock first)
  lowStockItems.sort((a, b) => {
    const urgencyA = a.currentStock / Math.max(a.parLevel, 1);
    const urgencyB = b.currentStock / Math.max(b.parLevel, 1);
    return urgencyA - urgencyB;
  });

  return {
    items: lowStockItems,
    count: lowStockItems.length,
    summary:
      lowStockItems.length > 0
        ? `⚠️ ${lowStockItems.length} items below par level. Most urgent: ${lowStockItems[0]?.name} (${lowStockItems[0]?.currentStock}/${lowStockItems[0]?.parLevel} units).`
        : "✅ All inventory items at or above par levels!",
  };
}

/**
 * Generate a purchase order for low stock items
 */
export async function generatePurchaseOrder(venueId: string): Promise<{
  items: Array<{
    name: string;
    currentStock: number;
    parLevel: number;
    orderQuantity: number;
    unit: string;
  }>;
  totalItems: number;
  message: string;
}> {
  const lowStock = await getLowStockItems(venueId);

  const purchaseItems = lowStock.items.map((item) => ({
    name: item.name,
    currentStock: item.currentStock,
    parLevel: item.parLevel,
    orderQuantity: Math.ceil(item.needToOrder * 1.2), // Add 20% buffer
    unit: "units",
  }));

  return {
    items: purchaseItems,
    totalItems: purchaseItems.length,
    message:
      purchaseItems.length > 0
        ? `Purchase order generated for ${purchaseItems.length} items. Review and submit to your supplier.`
        : "No items need ordering at this time.",
  };
}

/**
 * Get current inventory levels overview
 */
export async function getInventoryLevels(venueId: string): Promise<{
  total: number;
  lowStock: number;
  outOfStock: number;
  categories: Array<{ category: string; itemCount: number }>;
  summary: string;
}> {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("inventory")
    .select("id, name, category, quantity, par_level")
    .eq("venue_id", venueId);

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  const total = items?.length || 0;
  const lowStock = items?.filter((i) => (i.quantity || 0) < (i.par_level || 0)).length || 0;
  const outOfStock = items?.filter((i) => (i.quantity || 0) === 0).length || 0;

  // Group by category
  const categoryMap = new Map<string, number>();
  items?.forEach((item) => {
    const category = item.category || "Uncategorized";
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  });

  const categories = Array.from(categoryMap.entries()).map(([category, itemCount]) => ({
    category,
    itemCount,
  }));

  return {
    total,
    lowStock,
    outOfStock,
    categories,
    summary: `${total} inventory items tracked. ${lowStock} items low, ${outOfStock} out of stock. Categories: ${categories.length}.`,
  };
}
