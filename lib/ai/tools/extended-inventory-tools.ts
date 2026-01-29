// Servio AI Assistant - Extended Inventory Tools
// Stock adjustments and inventory management

import { createAdminClient } from "@/lib/supabase";

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
    unit: string;
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
  const supabase = createAdminClient();

  // Find ingredient by name
  const { data: ingredient, error: fetchError } = await supabase
    .from("ingredients")
    .select("id, name, unit")
    .eq("venue_id", venueId)
    .ilike("name", `%${itemName}%`)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch ingredient: ${fetchError.message}`);
  }

  if (!ingredient) {
    throw new Error(`Ingredient "${itemName}" not found. Please check the name and try again.`);
  }

  // Get current stock level
  const { data: stockLevel } = await supabase
    .from("v_stock_levels")
    .select("on_hand")
    .eq("ingredient_id", ingredient.id)
    .eq("venue_id", venueId)
    .maybeSingle();

  const oldQuantity = stockLevel?.on_hand || 0;
  const newQuantity = Math.max(0, oldQuantity + adjustment);

  // Create stock ledger entry (this updates the stock)
  const { error: ledgerError } = await supabase.from("stock_ledgers").insert({
    ingredient_id: ingredient.id,
    venue_id: venueId,
    delta: adjustment,
    reason: adjustment > 0 ? "receive" : "adjust",
    ref_type: "manual",
    note: reason || "AI Assistant adjustment",
  });

  if (ledgerError) {
    throw new Error(`Failed to adjust stock: ${ledgerError.message}`);
  }

  return {
    success: true,
    itemId: ingredient.id,
    itemName: ingredient.name,
    oldQuantity,
    newQuantity,
    adjustment,
    message: `Updated ${ingredient.name}: ${oldQuantity} → ${newQuantity} ${ingredient.unit || "units"} (${adjustment > 0 ? "+" : ""}${adjustment}).${reason ? ` Reason: ${reason}` : ""}`,
  };
}

/**
 * Get items that are low in stock
 */
export async function getLowStockItems(venueId: string): Promise<LowStockResult> {
  const supabase = createAdminClient();

  const { data: items, error } = await supabase
    .from("v_stock_levels")
    .select("ingredient_id, name, unit, on_hand, par_level")
    .eq("venue_id", venueId)
    .order("on_hand", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  const lowStockItems =
    items
      ?.filter((item) => {
        const onHand = item.on_hand || 0;
        const parLevel = item.par_level || 0;
        return onHand < parLevel;
      })
      .map((item) => ({
        id: item.ingredient_id,
        name: item.name,
        unit: item.unit || "units",
        currentStock: item.on_hand || 0,
        parLevel: item.par_level || 0,
        needToOrder: Math.max(0, (item.par_level || 0) - (item.on_hand || 0)),
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
        ? `⚠️ ${lowStockItems.length} items below par level. Most urgent: ${lowStockItems[0]?.name} (${lowStockItems[0]?.currentStock}/${lowStockItems[0]?.parLevel} ${lowStockItems[0]?.unit}).`
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
    unit: item.unit,
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
  summary: string;
}> {
  const supabase = createAdminClient();

  const { data: items, error } = await supabase
    .from("v_stock_levels")
    .select("ingredient_id, name, on_hand, par_level")
    .eq("venue_id", venueId);

  if (error) {
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  const total = items?.length || 0;
  const lowStock = items?.filter((i) => (i.on_hand || 0) < (i.par_level || 0)).length || 0;
  const outOfStock = items?.filter((i) => (i.on_hand || 0) === 0).length || 0;

  return {
    total,
    lowStock,
    outOfStock,
    summary: `${total} inventory items tracked. ${lowStock} items low, ${outOfStock} out of stock.`,
  };
}
