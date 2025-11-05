import { useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { MenuItem, BatchAction } from "../types";

export function useBatchOperations(menuItems: MenuItem[], onRefresh: () => void) {
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditItems, setBatchEditItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState<BatchAction>(null);
  const [batchEditValue, setBatchEditValue] = useState<unknown>(null);

  const openBatchEdit = () => {
    setBatchEditItems(menuItems.map((item) => ({ ...item })));
    setBatchEditOpen(true);
  };

  const handleBatchEditChange = (id: string, updates: Partial<MenuItem>) => {
    setBatchEditItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const saveBatchEdit = async () => {
    const supabase = createClient();
    if (!supabase) return;

    try {
      for (const item of batchEditItems) {
        await createClient()
          .from("menu_items")
          .update({ category: item.category })
          .eq("id", item.id);
      }
      setBatchEditOpen(false);
      onRefresh();
    } catch (error: unknown) {
      // Error silently handled
    }
  };

  const allVisibleIds = menuItems.map((item) => item.id);
  const allSelected = selectedItems.length === allVisibleIds.length && allVisibleIds.length > 0;

  const toggleSelectAll = () => {
    setSelectedItems(allSelected ? [] : allVisibleIds);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(
      selectedItems.includes(id) ? selectedItems.filter((i) => i !== id) : [...selectedItems, id]
    );
  };

  const handleBatchAction = (action: BatchAction) => {
    setBatchAction(action);
    setBatchEditValue(null);
  };

  const confirmBatchEdit = async () => {
    const supabase = createClient();
    if (!supabase) return;

    try {
      if (batchAction === "category") {
        if (!batchEditValue || (typeof batchEditValue === 'string' && !batchEditValue.trim())) {
          alert("Please enter a category.");
          return;
        }
        await createClient()
          .from("menu_items")
          .update({ category: batchEditValue })
          .in("id", selectedItems);
      } else if (batchAction === "price") {
        const price = Number(batchEditValue);
        if (!batchEditValue || isNaN(price) || price <= 0) {
          alert("Please enter a valid price greater than 0.");
          return;
        }
        await createClient().from("menu_items").update({ price }).in("id", selectedItems);
      } else if (batchAction === "unavailable") {
        await createClient()
          .from("menu_items")
          .update({ available: false })
          .in("id", selectedItems);
      } else if (batchAction === "edit") {
        await createClient().from("menu_items").update({ available: true }).in("id", selectedItems);
      } else if (batchAction === "delete") {
        await createClient().from("menu_items").delete().in("id", selectedItems);
      }

      setBatchAction(null);
      setSelectedItems([]);
      onRefresh();
    } catch (error: unknown) {
      // Error silently handled
    }
  };

  return {
    batchEditOpen,
    setBatchEditOpen,
    batchEditItems,
    selectedItems,
    batchAction,
    batchEditValue,
    setBatchEditValue,
    allSelected,
    openBatchEdit,
    handleBatchEditChange,
    saveBatchEdit,
    toggleSelectAll,
    toggleSelectItem,
    handleBatchAction,
    confirmBatchEdit,
  };
}
