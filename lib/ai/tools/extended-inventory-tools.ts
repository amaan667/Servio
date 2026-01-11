// Servio AI Assistant - Extended Inventory Tools
// Stock adjustments and inventory management

import { createAdminClient } from "@/lib/supabase";

interface StockAdjustmentResult {

}

interface LowStockResult {

  }>;

}

/**
 * Adjust inventory stock levels
 */
export async function adjustInventoryStock(

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

  if (ledgerError) {
    
    throw new Error(`Failed to adjust stock: ${ledgerError.message}`);
  }

  return {

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

      .map((item) => ({

        needToOrder: Math.max(0, (item.par_level || 0) - (item.on_hand || 0)),
      })) || [];

  // Sort by urgency (lowest stock first)
  lowStockItems.sort((a, b) => {
    const urgencyA = a.currentStock / Math.max(a.parLevel, 1);
    const urgencyB = b.currentStock / Math.max(b.parLevel, 1);
    return urgencyA - urgencyB;

  return {

        ? `⚠️ ${lowStockItems.length} items below par level. Most urgent: ${lowStockItems[0]?.name} (${lowStockItems[0]?.currentStock}/${lowStockItems[0]?.parLevel} ${lowStockItems[0]?.unit}).`

  };
}

/**
 * Generate a purchase order for low stock items
 */
export async function generatePurchaseOrder(venueId: string): Promise<{

  }>;

}> {
  const lowStock = await getLowStockItems(venueId);

  const purchaseItems = lowStock.items.map((item) => ({

    orderQuantity: Math.ceil(item.needToOrder * 1.2), // Add 20% buffer

  }));

  return {

        ? `Purchase order generated for ${purchaseItems.length} items. Review and submit to your supplier.`

  };
}

/**
 * Get current inventory levels overview
 */
export async function getInventoryLevels(venueId: string): Promise<{

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
