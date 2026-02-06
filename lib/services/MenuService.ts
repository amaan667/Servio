/**
 * Menu Service
 * Handles all menu-related business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient, supabaseAdmin } from "@/lib/supabase";

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
   * Get public menu data (venue + items + uploads)
   * Optimized for first-load performance - uses minimal cache TTL for instant updates
   * IMPORTANT: Uses admin client to bypass RLS for public/anonymous access (customers scanning QR codes)
   */
  async getPublicMenuFull(
    venueId: string,
    options: { limit: number; offset: number }
  ): Promise<Record<string, unknown>> {
    const cacheKey = this.getCacheKey("menu:public:full", venueId, JSON.stringify(options));

    return this.withCache(
      cacheKey,
      async () => {
        try {
          // Use admin client to bypass RLS - customers don't have auth cookies
          const supabase = supabaseAdmin();

          // Parallelize queries for better performance
          const [venueResult, menuItemsResult, uploadResult] = await Promise.all([
            // 1. Get Venue
            supabase
              .from("venues")
              .select("venue_id, venue_name")
              .eq("venue_id", venueId)
              .maybeSingle(),
            // 2. Get Menu Items - order by position (user reordering), then by created_at (PDF extraction order)
            supabase
              .from("menu_items")
              .select("*", { count: "exact" })
              .eq("venue_id", venueId)
              .order("position", { ascending: true, nullsFirst: false })
              .order("created_at", { ascending: true })
              .range(options.offset, options.offset + options.limit - 1),
            // 3. Get Uploads (optional - don't fail if missing)
            supabase
              .from("menu_uploads")
              .select("pdf_images, pdf_images_cc, category_order, created_at")
              .eq("venue_id", venueId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          const { data: venue, error: venueError } = venueResult;
          const { data: menuItems, error: menuError, count: menuCount } = menuItemsResult;
          const { data: uploadData, error: uploadError } = uploadResult;

          if (venueError) {
            throw new Error(`Failed to fetch venue: ${venueError.message}`);
          }

          if (!venue) {
            throw new Error("Venue not found");
          }

          if (menuError) {
            throw new Error(`Failed to fetch menu items: ${menuError.message}`);
          }

          // Upload data is optional - don't fail if it doesn't exist
          // PGRST116 is "not found" which is fine
          if (uploadError && uploadError.code !== "PGRST116") {
            // Non-critical error - continue without upload data
          }

          const pdfImages = (uploadData?.pdf_images || uploadData?.pdf_images_cc || []) as string[];
          const categoryOrder = uploadData?.category_order
            ? (uploadData.category_order as string[])
            : null;

          let returnedItems = menuItems || [];

          // First, order items by position field (same as menu management)
          // Items without position keep their original order from query (created_at = PDF extraction order)
          returnedItems.sort((a: MenuItem, b: MenuItem) => {
            const posA = a.position ?? Infinity;
            const posB = b.position ?? Infinity;
            if (posA !== posB) return posA - posB;
            // Preserve original order for items without position
            return 0;
          });

          // Then group by category using category_order from menu_uploads
          if (categoryOrder && categoryOrder.length > 0) {
            const categorySet = new Set(categoryOrder);
            // Sort categories according to category_order
            const orderedCategories = categoryOrder.filter(cat => 
              returnedItems.some((item: MenuItem) => item.category === cat)
            );
            // Get remaining categories not in category_order
            const remainingCategories = [...new Set(returnedItems
              .map((item: MenuItem) => item.category)
              .filter(cat => !categorySet.has(cat)))
            ];
            const finalCategoryOrder = [...orderedCategories, ...remainingCategories];

            // Re-sort items: first by category order, then by position within each category
            returnedItems.sort((a: MenuItem, b: MenuItem) => {
              const catAIndex = finalCategoryOrder.indexOf(a.category);
              const catBIndex = finalCategoryOrder.indexOf(b.category);
              if (catAIndex !== catBIndex) return catAIndex - catBIndex;
              // Items with position set use that, others preserve original order
              const posA = a.position ?? Infinity;
              const posB = b.position ?? Infinity;
              if (posA !== posB) return posA - posB;
              return 0; // Preserve original order for items without position
            });
          }
          // Fetch corrections - handle RLS errors gracefully for public access
          try {
            const { data: corrections } = await supabase
              .from("menu_item_corrections")
              .select("menu_item_id, item_name, field, value_text, value_number")
              .eq("venue_id", venueId);
            if (corrections?.length) {
              const { applyCorrections: apply } = await import("@/lib/menu-corrections");
              returnedItems = apply(returnedItems as { id: string; name: string; [k: string]: unknown }[], corrections);
            }
          } catch (correctionsError) {
            // Corrections are optional - public users may not have RLS access
            // Continue without corrections, menu items will work fine
          }
          const availableCount = menuCount || returnedItems.length || 0;

          return {
            venue: {
              id: venue.venue_id,
              name: venue.venue_name,
            },
            menuItems: returnedItems,
            totalItems: availableCount,
            pdfImages,
            categoryOrder,
            pagination: {
              limit: options.limit,
              offset: options.offset,
              returned: returnedItems.length,
              hasMore: availableCount > options.offset + returnedItems.length,
            },
          };
        } catch (error) {
          // Enhanced error handling - re-throw with more context
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Failed to load menu: ${errorMessage}`);
        }
      },
      5 // Minimal cache (5 seconds) - ensures menu updates appear almost instantly
    );
  }
}

// Export singleton instance
export const menuService = new MenuService();
