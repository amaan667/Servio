/**
 * Menu Service
 * Handles all menu-related business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";

export interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  image_url?: string | null;
  is_available: boolean;
  position?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  position?: number | null;
  description?: string | null;
}

export class MenuService extends BaseService {
  /**
   * Get menu items with caching
   */
  async getMenuItems(
    venueId: string,
    options?: { includeUnavailable?: boolean; category?: string }
  ): Promise<MenuItem[]> {
    const cacheKey = this.getCacheKey("menu:items", venueId, JSON.stringify(options));

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        let query = supabase
          .from("menu_items")
          .select("*")
          .eq("venue_id", venueId)
          .order("category", { ascending: true })
          .order("position", { ascending: true });

        if (!options?.includeUnavailable) {
          query = query.eq("is_available", true);
        }

        if (options?.category) {
          query = query.eq("category", options.category);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      300
    ); // 5 minute cache
  }

  /**
   * Get menu item by ID
   */
  async getMenuItem(itemId: string, venueId: string): Promise<MenuItem | null> {
    const cacheKey = this.getCacheKey("menu:item", venueId, itemId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("id", itemId)
          .eq("venue_id", venueId)
          .single();

        if (error) throw error;
        return data;
      },
      300
    );
  }

  /**
   * Create menu item
   */
  async createMenuItem(
    venueId: string,
    itemData: Omit<MenuItem, "id" | "venue_id" | "created_at" | "updated_at">
  ): Promise<MenuItem> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        ...itemData,
        venue_id: venueId,
      })
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await this.invalidateCachePattern(`menu:*:${venueId}:*`);

    return data;
  }

  /**
   * Update menu item
   */
  async updateMenuItem(
    itemId: string,
    venueId: string,
    updates: Partial<Omit<MenuItem, "id" | "venue_id" | "created_at">>
  ): Promise<MenuItem> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from("menu_items")
      .update(updates)
      .eq("id", itemId)
      .eq("venue_id", venueId)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await this.invalidateCachePattern(`menu:*:${venueId}:*`);

    return data;
  }

  /**
   * Delete menu item
   */
  async deleteMenuItem(itemId: string, venueId: string): Promise<void> {
    const supabase = await createSupabaseClient();
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", itemId)
      .eq("venue_id", venueId);

    if (error) throw error;

    // Invalidate cache
    await this.invalidateCachePattern(`menu:*:${venueId}:*`);
  }

  /**
   * Toggle item availability
   */
  async toggleAvailability(
    itemId: string,
    venueId: string,
    isAvailable: boolean
  ): Promise<MenuItem> {
    return this.updateMenuItem(itemId, venueId, { is_available: isAvailable });
  }

  /**
   * Update item price
   */
  async updatePrice(itemId: string, venueId: string, newPrice: number): Promise<MenuItem> {
    return this.updateMenuItem(itemId, venueId, { price: newPrice });
  }

  /**
   * Bulk update prices
   */
  async bulkUpdatePrices(
    venueId: string,
    updates: Array<{ id: string; price: number }>
  ): Promise<void> {
    const supabase = await createSupabaseClient();

    for (const update of updates) {
      const { error } = await supabase
        .from("menu_items")
        .update({ price: update.price })
        .eq("id", update.id)
        .eq("venue_id", venueId);

      if (error) throw error;
    }

    // Invalidate cache
    await this.invalidateCachePattern(`menu:*:${venueId}:*`);
  }

  /**
   * Get categories
   */
  async getCategories(venueId: string): Promise<MenuCategory[]> {
    const cacheKey = this.getCacheKey("menu:categories", venueId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("menu_categories")
          .select("*")
          .eq("venue_id", venueId)
          .order("position", { ascending: true });

        if (error) throw error;
        return data || [];
      },
      600
    ); // 10 minute cache
  }

  /**
   * Get public menu (no auth required)
   */
  async getPublicMenu(venueSlug: string): Promise<MenuItem[]> {
    const cacheKey = this.getCacheKey("menu:public", venueSlug);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();

        // Get venue by slug
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("slug", venueSlug)
          .single();

        if (!venue) {
          throw new Error("Venue not found");
        }

        // Get menu items
        const { data, error } = await supabase
          .from("menu_items")
          .select("*")
          .eq("venue_id", venue.venue_id)
          .eq("is_available", true)
          .order("category", { ascending: true })
          .order("position", { ascending: true });

        if (error) throw error;
        return data || [];
      },
      300
    );
  }
}

// Export singleton instance
export const menuService = new MenuService();
