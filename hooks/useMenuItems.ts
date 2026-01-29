/**
 * Custom Hook: useMenuItems
 * Extracted from MenuManagementClient.tsx (1,511 lines)
 * Manages menu items state and operations
 */

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  created_at: string;
  position?: number;
}

export function useMenuItems(venueId: string) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenuItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueId)
        .order("category")
        .order("position");

      if (fetchError) throw fetchError;

      setMenuItems(data || []);
    } catch (_err) {
      setError("Failed to load menu items");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    if (venueId) {
      fetchMenuItems();
    }
  }, [venueId, fetchMenuItems]);

  const addMenuItem = useCallback(async (item: Omit<MenuItem, "id" | "created_at">) => {
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("menu_items")
        .insert([item])
        .select()
        .single();

      if (insertError) throw insertError;

      setMenuItems((prev) => [...prev, data]);
      return { success: true, data };
    } catch (_err) {
      return { success: false, error: _err };
    }
  }, []);

  const updateMenuItem = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("menu_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      setMenuItems((prev) => prev.map((item) => (item.id === id ? data : item)));
      return { success: true, data };
    } catch (_err) {
      return { success: false, error: _err };
    }
  }, []);

  const deleteMenuItem = useCallback(async (id: string) => {
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from("menu_items").delete().eq("id", id);

      if (deleteError) throw deleteError;

      setMenuItems((prev) => prev.filter((item) => item.id !== id));
      return { success: true };
    } catch (_err) {
      return { success: false, error: _err };
    }
  }, []);

  const toggleAvailability = useCallback(
    async (id: string, isAvailable: boolean) => {
      return updateMenuItem(id, { is_available: isAvailable });
    },
    [updateMenuItem]
  );

  const updatePrice = useCallback(
    async (id: string, price: number) => {
      return updateMenuItem(id, { price });
    },
    [updateMenuItem]
  );

  const reorderItems = useCallback(async (items: MenuItem[]) => {
    try {
      const supabase = createClient();

      // Update positions
      const updates = items.map((item, index) => ({
        id: item.id,
        position: index,
      }));

      const { error: updateError } = await supabase
        .from("menu_items")
        .upsert(updates, { onConflict: "id" });

      if (updateError) throw updateError;

      setMenuItems(items);
      return { success: true };
    } catch (_err) {
      return { success: false, error: _err };
    }
  }, []);

  return {
    menuItems,
    loading,
    error,
    fetchMenuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
    updatePrice,
    reorderItems,
  };
}
