import { useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { DropResult } from "@hello-pangea/dnd";
import { MenuItem } from "../types";

export function useDragAndDrop(menuItems: MenuItem[], setMenuItems: (items: MenuItem[]) => void) {
  const { toast } = useToast();

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const category = source.droppableId;

    const categoryItems = menuItems
      .filter(item => item.category === category)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    const newItems = Array.from(categoryItems);
    const [removed] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, removed);

    const updatedItems = menuItems.map(item => {
      if (item.category === category) {
        const newIndex = newItems.findIndex(newItem => newItem.id === item.id);
        return { ...item, position: newIndex };
      }
      return item;
    });

    setMenuItems(updatedItems);

    try {
      const supabase = createClient();
      const updates = newItems.map((item, index) => 
        supabase
          .from('menu_items')
          .update({ position: index })
          .eq('id', item.id)
      );

      await Promise.all(updates);

      toast({
        title: "Items reordered",
        description: "Menu items have been reordered successfully",
      });
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to save item order",
        variant: "destructive",
      });
    }
  };

  return { handleDragEnd };
}

