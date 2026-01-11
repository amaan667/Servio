/**
 * Menu Repository
 * Centralized data access for menu items
 */

import { createServerSupabase } from "@/lib/supabase";

type MenuItem = unknown; // Database['public']['Tables']['menu_items']['Row'];
type MenuItemInsert = unknown; // Database['public']['Tables']['menu_items']['Insert'];
type MenuItemUpdate = unknown; // Database['public']['Tables']['menu_items']['Update'];

export class MenuRepo {
  /**
   * Get menu items by venue
   */
  static async listByVenue(

    options?: {
      category?: string;
      available?: boolean;
    }
  ) {
    const supabase = await createServerSupabase();

    let query = supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", venueId)
      .order("position", { ascending: true });

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    if (options?.available !== undefined) {
      query = query.eq("is_available", options.available);
    }

    return query;
  }

  /**
   * Get menu item by ID
   */
  static async findById(itemId: string) {
    const supabase = await createServerSupabase();
    return supabase.from("menu_items").select("*").eq("id", itemId).single();
  }

  /**
   * Create menu item
   */
  static async create(item: MenuItemInsert) {
    const supabase = await createServerSupabase();
    return supabase.from("menu_items").insert(item).select().single();
  }

  /**
   * Update menu item
   */
  static async update(itemId: string, updates: MenuItemUpdate) {
    const supabase = await createServerSupabase();
    return supabase.from("menu_items").update(updates).eq("id", itemId).select().single();
  }

  /**
   * Delete menu item
   */
  static async delete(itemId: string) {
    const supabase = await createServerSupabase();
    return supabase.from("menu_items").delete().eq("id", itemId);
  }

  /**
   * Toggle availability
   */
  static async toggleAvailability(itemId: string, available: boolean) {
    return this.update(itemId, { is_available: available });
  }

  /**
   * Update price
   */
  static async updatePrice(itemId: string, price: number) {
    return this.update(itemId, { price });
  }

  /**
   * Bulk update prices
   */
  static async bulkUpdatePrices(updates: Array<{ id: string; price: number }>) {
    const supabase = await createServerSupabase();

    return Promise.all(
      updates.map(({ id, price }) => supabase.from("menu_items").update({ price }).eq("id", id))
    );
  }

  /**
   * Get categories by venue
   */
  static async getCategories(venueId: string) {
    const supabase = await createServerSupabase();
    return supabase
      .from("menu_items")
      .select("category")
      .eq("venue_id", venueId)
      .not("category", "is", null);
  }

  /**
   * Get menu items count by venue
   */
  static async countByVenue(venueId: string, available?: boolean) {
    const supabase = await createServerSupabase();

    let query = supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);

    if (available !== undefined) {
      query = query.eq("is_available", available);
    }

    return query;
  }
}
