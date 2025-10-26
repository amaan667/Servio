import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { MenuItem } from "../types";

export function useMenuItems(venueId: string) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  const { toast } = useToast();

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data: items, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueId)
        .order("position", { ascending: true, nullsFirst: false });

      if (error) {
        toast({
          title: "Error",
          description: `Failed to load menu items: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      setMenuItems(items || []);

      if (items && items.length > 0) {
        const { data: uploadData } = await supabase
          .from("menu_uploads")
          .select("category_order")
          .eq("venue_id", venueId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (uploadData && uploadData.length > 0) {
          setCategoryOrder(uploadData[0]?.category_order);
        }
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: `Failed to load menu items: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (venueId) {
      loadMenuItems();
    }
  }, [venueId]);

  return {
    menuItems,
    loading,
    categoryOrder,
    setMenuItems,
    loadMenuItems,
  };
}
