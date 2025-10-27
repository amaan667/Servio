"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { RecipeDialog } from "@/components/inventory/RecipeDialog";
import { MenuManagementProps, NewItem, MenuItem } from "./types";

// Hooks
import { useMenuData } from "./hooks/useMenuData";
import { useMenuItemActions } from "./hooks/useMenuItemActions";
import { useBatchOperations } from "./hooks/useBatchOperations";

// Components
import { MenuUploadSection } from "./components/MenuUploadSection";
import { CategoriesManagementSection } from "./components/CategoriesManagementSection";
import { MenuItemList } from "./components/MenuItemList";
import { AddMenuItemSection } from "./components/AddMenuItemSection";
import { BatchActionBar } from "./components/BatchActionBar";
import { BatchActionDialog } from "./components/BatchActionDialog";

export function MenuManagement({
  venueId,
  session: _session,
  refreshTrigger,
}: MenuManagementProps) {
  const [newItem, setNewItem] = useState<NewItem>({
    name: "",
    description: "",
    price: 0,
    category: "",
    available: true,
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemDraft, setEditItemDraft] = useState<Partial<MenuItem> | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  const { menuItems, setMenuItems, loading, error, categoryOrder, fetchMenu } = useMenuData(
    venueId,
    refreshTrigger
  );

  const {
    saving,
    error: actionError,
    handleAddItem,
    handleUpdateItem,
    handleDeleteItem,
    handleClearMenu,
  } = useMenuItemActions(venueId, fetchMenu);

  const {
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
  } = useBatchOperations(menuItems, fetchMenu);

  const supabase = createClient();

  const getCategories = () => {
    const categories = Array.from(new Set(menuItems.map((item) => item.category)));
    if (categoryOrder) {
      return categoryOrder.filter((cat) => categories.includes(cat));
    }
    return categories.sort();
  };

  const getItemsByCategory = (category: string) => {
    return menuItems
      .filter((item) => item.category === category)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  };

  const toggleCategoryExpansion = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const handleAddItemWrapper = async () => {
    await handleAddItem(newItem);
    setNewItem({
      name: "",
      description: "",
      price: 0,
      category: "",
      available: true,
    });
    await fetchMenu();
  };

  const handleUpdateItemWrapper = async (itemId: string, updates: Partial<MenuItem>) => {
    setMenuItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
    await handleUpdateItem(itemId, updates);
    await fetchMenu();
  };

  const handleDeleteItemWrapper = async (itemId: string) => {
    setMenuItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    await handleDeleteItem(itemId);
    await fetchMenu();
  };

  return (
    <div className="space-y-6">
      {!supabase && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Service is not configured. Menu management is disabled.
          </AlertDescription>
        </Alert>
      )}

      {(error || actionError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || actionError}</AlertDescription>
        </Alert>
      )}

      <MenuUploadSection venueId={venueId} onSuccess={fetchMenu} />

      {menuItems.length > 0 && (
        <CategoriesManagementSection
          venueId={venueId}
          menuItemsCount={menuItems.length}
          onRefresh={fetchMenu}
        />
      )}

      <MenuItemList
        menuItems={menuItems}
        loading={loading}
        selectedItems={selectedItems}
        editingItemId={editingItemId}
        editItemDraft={editItemDraft}
        expandedCategories={expandedCategories}
        saving={saving}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectItem={toggleSelectItem}
        onToggleCategoryExpansion={toggleCategoryExpansion}
        onSetEditingItemId={setEditingItemId}
        onSetEditItemDraft={setEditItemDraft}
        onUpdateItem={handleUpdateItemWrapper}
        onDeleteItem={handleDeleteItemWrapper}
        onOpenRecipeDialog={(item) => {
          setSelectedMenuItem(item);
          setRecipeDialogOpen(true);
        }}
        getCategories={getCategories}
        getItemsByCategory={getItemsByCategory}
      />

      <AddMenuItemSection
        newItem={newItem}
        setNewItem={setNewItem}
        onAddItem={handleAddItemWrapper}
        saving={saving}
        loading={loading}
        categories={getCategories()}
      />

      <BatchActionBar
        selectedCount={selectedItems.length}
        onMarkUnavailable={() => handleBatchAction("unavailable")}
        onChangeCategory={() => handleBatchAction("category")}
        onBulkPriceEdit={() => handleBatchAction("price")}
        onDelete={() => handleBatchAction("delete")}
      />

      <BatchActionDialog
        batchAction={batchAction}
        batchEditValue={batchEditValue}
        setBatchEditValue={setBatchEditValue}
        onClose={() => handleBatchAction(null)}
        onConfirm={confirmBatchEdit}
        saving={saving}
      />

      {selectedMenuItem && (
        <RecipeDialog
          open={recipeDialogOpen}
          onOpenChange={setRecipeDialogOpen}
          menuItemId={selectedMenuItem.id}
          menuItemName={selectedMenuItem.name}
          venueId={venueId}
        />
      )}
    </div>
  );
}
