/**
 * Inventory Service
 * Handles all inventory and stock-related business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";

export interface InventoryItem {
  id: string;
  venue_id: string;
  name: string;
  sku?: string | null;
  unit: string;
  on_hand: number;
  min_stock: number;
  par_level?: number;
  cost_per_unit?: number;
  category?: string | null;
  supplier?: string | null;
  created_at: string;
  updated_at: string;
}

export class InventoryService extends BaseService {
  /**
   * Get all inventory items for a venue
   */
  async getInventory(venueId: string): Promise<InventoryItem[]> {
    const cacheKey = this.getCacheKey("inventory:list", venueId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("v_stock_levels")
          .select("*")
          .eq("venue_id", venueId)
          .order("name", { ascending: true });

        if (error) throw error;
        return data || [];
      },
      300
    );
  }

  /**
   * Get low stock items
   */
  async getLowStock(venueId: string): Promise<InventoryItem[]> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("venue_id", venueId)
      .lt("on_hand", "min_stock");

    if (error) throw error;
    return data || [];
  }

  /**
   * Adjust stock levels (atomic via RPC)
   */
  async adjustStock(
    venueId: string,
    ingredientId: string,
    amount: number,
    reason: string,
    userId: string
  ): Promise<void> {
    const supabase = await createSupabaseClient();
    const { error } = await supabase.rpc("adjust_stock_v2", {
      p_venue_id: venueId,
      p_ingredient_id: ingredientId,
      p_amount: amount,
      p_reason: reason,
      p_user_id: userId,
    });

    if (error) throw error;

    await this.invalidateCachePattern(`inventory:*:${venueId}:*`);
  }

  /**
   * Create an inventory ingredient
   */
  async createIngredient(
    venueId: string,
    data: {
      name: string;
      sku?: string | null;
      unit: string;
      cost_per_unit?: number;
      par_level?: number;
      reorder_level?: number;
      supplier?: string | null;
      initial_stock?: number;
    }
  ): Promise<InventoryItem> {
    const supabase = await createSupabaseClient();

    // 1. Create ingredient
    const { data: ingredient, error: ingredientError } = await supabase
      .from("ingredients")
      .insert({
        venue_id: venueId,
        name: data.name,
        sku: data.sku,
        unit: data.unit,
        cost_per_unit: data.cost_per_unit,
        par_level: data.par_level,
        reorder_level: data.reorder_level,
        supplier: data.supplier,
      })
      .select()
      .single();

    if (ingredientError) throw ingredientError;

    // 2. Initial stock movement
    if (data.initial_stock && data.initial_stock > 0) {
      await supabase.from("stock_ledgers").insert({
        ingredient_id: ingredient.id,
        venue_id: venueId,
        delta: data.initial_stock,
        reason: "receive",
        ref_type: "manual",
        note: "Initial stock",
      });
    }

    await this.invalidateCachePattern(`inventory:*:${venueId}:*`);
    return ingredient;
  }
}

export const inventoryService = new InventoryService();
