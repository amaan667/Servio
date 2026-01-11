import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { DropResult } from "@hello-pangea/dnd";
import { MenuItem } from "../types";

export function useDragAndDrop(

  const { toast } = useToast();

  // Handle item drag and drop within a category
  const handleItemDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const category = source.droppableId;

    const categoryItems = menuItems
      .filter((item) => item.category === category)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    const newItems = Array.from(categoryItems);
    const [removed] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, removed);

    const updatedItems = menuItems.map((item) => {
      if (item.category === category) {
        const newIndex = newItems.findIndex((newItem) => newItem.id === item.id);
        return { ...item, position: newIndex };
      }
      return item;

    setMenuItems(updatedItems);

    try {
      const supabase = createClient();
      const updates = newItems.map((item, index) =>
        supabase.from("menu_items").update({ position: index }).eq("id", item.id)
      );

      await Promise.all(updates);

      toast({

    } catch (_error) {
      toast({

    }
  };

  // Handle category drag and drop
  const handleCategoryDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;

    // Get current categories
    const uniqueCategories = Array.from(new Set(menuItems.map((item) => item.category)));
    const currentOrder =
      categoryOrder && categoryOrder.length > 0
        ? categoryOrder.filter((cat) => uniqueCategories.includes(cat))

    const [reorderedCategory] = newOrder.splice(source.index, 1);
    newOrder.splice(destination.index, 0, reorderedCategory);

    setCategoryOrder(newOrder);

    // Save to localStorage immediately
    localStorage.setItem(`category-order-${venueId}`, JSON.stringify(newOrder));

    try {
      // Save to database via API
      const response = await fetch("/api/menu/categories", {

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, categories: newOrder }),

      if (response.ok) {
        toast({

      } else {
        toast({

      }
    } catch (_error) {
      toast({

    }
  };

  return {
    handleItemDragEnd,
    handleCategoryDragEnd,
  };
}
