"use client";

import type React from "react";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Upload,
  Link,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Define types locally since they're not exported from supabase
interface BaseMenuItem {
  id: string;
  venue_id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  available: boolean;
  position?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface AuthSession {
  user: {
    id: string;
    email?: string;
  };
  venue: {
    id: string;
    venue_id?: string;
  };
}

interface MenuManagementProps {
  venueId: string;
  session: AuthSession;
  refreshTrigger?: number;
}

type MenuItem = BaseMenuItem & { category_position?: number };

export function MenuManagement({ venueId, session, refreshTrigger }: MenuManagementProps) {
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  // PDF/URL upload removed
  // Remove menuUrl state
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    available: true,
  });
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditItems, setBatchEditItems] = useState<MenuItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState<null | "edit" | "unavailable" | "category" | "price" | "delete">(null);
  const [batchEditValue, setBatchEditValue] = useState<any>(null);
  const [editItemDraft, setEditItemDraft] = useState<Partial<MenuItem> | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCategoriesManagement, setShowCategoriesManagement] = useState(false);
  
  // Debug: Log state changes
  useEffect(() => {
  }, [showCategoriesManagement]);
  
  // Debug: Log initial state
  useEffect(() => {
  }, []);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Handle venue ID format - the actual venue_id in database has 'venue-' prefix
  const venueUuid = venueId.startsWith('venue-') ? venueId : `venue-${venueId}`;
  const originalVenueId = venueId; // Keep original for fallback
  const supabase = createClient();

  const fetchMenu = async () => {
    if (!supabase) {
      setError("Supabase client not available.");
      setLoading(false);
      return;
    }


    try {
      // First, let's check if there are ANY menu items in the database
      const { data: allItems, error: allItemsError } = await supabase
        .from("menu_items")
        .select("venue_id, name, id, created_at")
        .limit(10);
      
      
      // Also check what venue IDs exist in the database
      const { data: allVenues, error: venuesError } = await supabase
        .from("venues")
        .select("venue_id, name")
        .limit(10);
      

      // Now query for this specific venue - try both venue ID formats
      let { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueUuid)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      // If no items found with transformed ID, try with original ID
      if (!data || data.length === 0) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("menu_items")
          .select("*")
          .eq("venue_id", originalVenueId)
          .order("category", { ascending: true })
          .order("name", { ascending: true });
        
        if (fallbackData && fallbackData.length > 0) {
          data = fallbackData;
          error = fallbackError;
        }
      }

      // Fetch the most recent menu upload to get category order - try both venue ID formats
      let { data: uploadData, error: uploadError } = await supabase
        .from("menu_uploads")
        .select("category_order")
        .eq("venue_id", venueUuid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no upload data found with transformed ID, try with original ID
      if (!uploadData && !uploadError) {
        const { data: fallbackUploadData, error: fallbackUploadError } = await supabase
          .from("menu_uploads")
          .select("category_order")
          .eq("venue_id", originalVenueId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (fallbackUploadData) {
          uploadData = fallbackUploadData;
          uploadError = fallbackUploadError;
        }
      }



      if (error) {
        logger.error("Failed to fetch menu from Supabase", {
          error: error.message,
          code: error.code,
          venueUuid,
        });
        setError("Failed to load menu items.");
      } else {
        logger.log("Menu fetched successfully", {
          itemCount: data?.length || 0,
          categories: [...new Set(data?.map((item: any) => item.category) || [])],
        });
        setMenuItems(data || []);
      }

      // Extract categories from the category_order column
      if (uploadData?.category_order && Array.isArray(uploadData.category_order)) {
        // Categories are stored as an array of strings in the correct PDF order
        const categories = uploadData.category_order;
        setCategoryOrder(categories);
      } else {
        setCategoryOrder(null);
      }
        
      // Debug: Log the actual items found
      if (data && data.length > 0) {
      } else {
        
        // Try to check if there are any menu items at all in the database
        const { data: allItems, error: allItemsError } = await supabase
          .from("menu_items")
          .select("venue_id, COUNT(*)")
          .group("venue_id");
        
        if (allItemsError) {
        } else {
        }
      }
    } catch (error: any) {
      logger.error("Unexpected error fetching menu", { error });
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    if (!supabase) return;

    logger.log("Setting up real-time subscription");
    const channel = supabase
      .channel(`menu-management-${venueUuid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `venue_id=eq.${venueUuid}`,
        },
        (payload: any) => {
          logger.log("Real-time change detected, refetching menu", {
            payload,
          });
          fetchMenu();
        },
      )
      .subscribe((status: any) => {
        logger.log("Real-time subscription status", { status });
      });

    return () => {
      logger.log("Cleaning up real-time subscription");
      if (supabase) {
        createClient().removeChannel(channel);
      }
    };
  }, [fetchMenu, venueUuid]);

  // Refresh menu when refreshTrigger changes (e.g., after PDF upload)
  useEffect(() => {
    if (refreshTrigger) {
      fetchMenu();
    }
  }, [refreshTrigger, fetchMenu]);

  // Enhanced file upload handler for both input and drag-and-drop
  // Removed file upload handlers

  // Removed file upload input handler

  // Drag-and-drop handlers
  // Removed drag-and-drop handlers

  const handleAddItem = async () => {
    logger.log("Starting add item process", {
      name: newItem.name.trim(),
      category: newItem.category.trim(),
      price: newItem.price,
      venueUuid,
      userId: session.user.id,
    });
    if (
      !newItem.name.trim() ||
      !newItem.category.trim() ||
      newItem.price <= 0
    ) {
      setError("Please fill out all required fields with valid values.");
      return;
    }
    setSaving("add");
    setError(null);
    try {
      // Use API route to insert
      const res = await fetch("/api/extract-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              venue_id: venueUuid,
              name: newItem.name.trim(),
              description: newItem.description.trim(),
              price: newItem.price,
              category: newItem.category.trim(),
              available: newItem.available,
            },
          ],
          venue_id: venueUuid,
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        logger.error("Failed to add item to Supabase", {
          error: result.error,
          venueUuid,
          userId: session.user.id,
        });
        setError(result.error || "Failed to add item.");
      } else {
        logger.log("Item added successfully");
        setNewItem({
          name: "",
          description: "",
          price: 0,
          category: "",
          available: true,
        });
      }
    } catch (error: any) {
      logger.error("Unexpected error adding item", { error });
      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateItem = async (
    itemId: string,
    updates: Partial<MenuItem>,
  ) => {
    logger.log("Updating item", { itemId, updates });

    if (!supabase) return;

    setSaving(itemId);

    // Optimistic update - update UI immediately
    setMenuItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      )
    );

    try {
      const { error } = await supabase
        .from("menu_items")
        .update(updates)
        .eq("id", itemId);

      if (error) {
        logger.error("Failed to update item", {
          itemId,
          error: error.message,
          code: error.code,
        });
        setError(`Failed to update item: ${error.message}`);
        // Revert optimistic update on error
        setMenuItems(prevItems => 
          prevItems.map(item => 
            item.id === itemId ? { ...item, ...updates } : item
          )
        );
      } else {
        logger.log("Item updated successfully", { itemId });
      }
    } catch (error: any) {
      logger.error("Unexpected error updating item", { error });
      setError("An unexpected error occurred.");
      // Revert optimistic update on error
      setMenuItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId ? { ...item, ...updates } : item
        )
      );
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;
    logger.log("Deleting item", { itemId });

    if (!supabase) return;

    setSaving(itemId);

    // Store the item to restore on error
    const itemToDelete = menuItems.find(item => item.id === itemId);

    // Optimistic update - remove from UI immediately
    setMenuItems(prevItems => prevItems.filter(item => item.id !== itemId));

    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId);

      if (error) {
        logger.error("Failed to delete item", {
          itemId,
          error: error.message,
          code: error.code,
        });
        setError(`Failed to delete item: ${error.message}`);
        // Revert optimistic update on error
        if (itemToDelete) {
          setMenuItems(prevItems => [...prevItems, itemToDelete]);
        }
      } else {
        logger.log("Item deleted successfully", { itemId });
      }
    } catch (error: any) {
      logger.error("Unexpected error deleting item", { error });
      setError("An unexpected error occurred.");
      // Revert optimistic update on error
      if (itemToDelete) {
        setMenuItems(prevItems => [...prevItems, itemToDelete]);
      }
    } finally {
      setSaving(null);
    }
  };

  // Clear all menu items
  const handleClearMenu = async () => {
    if (!window.confirm("Are you sure you want to clear the entire menu? This cannot be undone.")) return;
    setSaving("clear");
    setError(null);
    try {
      if (!supabase) {
        setError("Supabase is not configured.");
        setSaving(null);
        return;
      }
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueUuid);
      if (error) {
        setError("Failed to clear menu: " + error.message);
      } else {
        setMenuItems([]);
      }
    } catch (error: any) {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };
  // Batch edit logic
  const openBatchEdit = () => {
    setBatchEditItems(menuItems.map(item => ({ ...item })));
    setBatchEditOpen(true);
  };
  const handleBatchEditChange = (id: string, updates: Partial<MenuItem>) => {
    setBatchEditItems(items => items.map(item => item.id === id ? { ...item, ...updates } : item));
  };
  const saveBatchEdit = async () => {
    setSaving("batch");
    setError(null);
    try {
      if (!supabase) {
        setError("Supabase is not configured.");
        setSaving(null);
        return;
      }
      for (const item of batchEditItems) {
        await createClient().from("menu_items").update({ category: item.category }).eq("id", item.id);
      }
      setBatchEditOpen(false);
      fetchMenu();
    } catch (error: any) {
      setError("Failed to save batch edits.");
    } finally {
      setSaving(null);
    }
  };

  // Select all logic
  const allVisibleIds = menuItems.map(item => item.id);
  const allSelected = selectedItems.length === allVisibleIds.length && allVisibleIds.length > 0;
  const toggleSelectAll = () => {
    setSelectedItems(allSelected ? [] : allVisibleIds);
  };

  const toggleCategoryExpansion = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const addNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    setSaving("add-category");
    try {
      // Add a placeholder item to create the category
      const { error } = await supabase
        .from("menu_items")
        .insert({
          venue_id: venueUuid,
          name: `New Item in ${newCategoryName}`,
          description: "Please edit this item",
          price: 0.01,
          category: newCategoryName.trim(),
          available: false
        });

      if (error) throw error;
      
      setNewCategoryName("");
      fetchMenu();
    } catch (error: any) {
      setError(`Failed to add category: ${error.message}`);
    } finally {
      setSaving(null);
    }
  };

  const resetToPdfOrder = () => {
    if (categoryOrder && Array.isArray(categoryOrder)) {
      setExpandedCategories(new Set(categoryOrder));
      // Don't automatically expand the categories management section
      // setShowCategoriesManagement(true);
    }
  };
  const toggleSelectItem = (id: string) => {
    setSelectedItems(selectedItems.includes(id)
      ? selectedItems.filter(i => i !== id)
      : [...selectedItems, id]);
  };
  // Batch actions
  const handleBatchAction = (action: typeof batchAction) => {
    setBatchAction(action);
    setBatchEditValue(null);
  };
  const confirmBatchEdit = async () => {
    if (!supabase) return;
    setSaving("batch");
    setError(null);
    try {
      if (batchAction === "category") {
        if (!batchEditValue || !batchEditValue.trim()) {
          alert("Please enter a category.");
          setSaving(null);
          return;
        }
        await createClient().from("menu_items").update({ category: batchEditValue }).in("id", selectedItems);
      } else if (batchAction === "price") {
        const price = Number(batchEditValue);
        if (!batchEditValue || isNaN(price) || price <= 0) {
          alert("Please enter a valid price greater than 0.");
          setSaving(null);
          return;
        }
        await createClient().from("menu_items").update({ price }).in("id", selectedItems);
      } else if (batchAction === "unavailable") {
        await createClient().from("menu_items").update({ available: false }).in("id", selectedItems);
      } else if (batchAction === "edit") {
        await createClient().from("menu_items").update({ available: true }).in("id", selectedItems);
      } else if (batchAction === "delete") {
        await createClient().from("menu_items").delete().in("id", selectedItems);
      }
      setBatchAction(null);
      setSelectedItems([]);
      fetchMenu();
    } catch (error: any) {
      setError("Failed to perform batch action.");
    } finally {
      setSaving(null);
    }
  };

  // Group and sort categories with starters first
  const categoryGroups: Record<string, MenuItem[]> = {};
  menuItems.forEach((item: MenuItem) => {
    const cat = item.category || "Uncategorized";
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(item);
  });
  
  // Derive category order from the order items appear in the database (which reflects PDF order)
  const deriveCategoryOrder = (items: MenuItem[]) => {
    const categoryFirstAppearance: { [key: string]: number } = {};
    
    items.forEach((item, index) => {
      const category = item.category || 'Uncategorized';
      if (!(category in categoryFirstAppearance)) {
        categoryFirstAppearance[category] = index;
      }
    });
    
    // Sort categories by their first appearance in the menu items
    return Object.keys(categoryFirstAppearance).sort((a, b) => 
      categoryFirstAppearance[a] - categoryFirstAppearance[b]
    );
  };

  const dynamicCategoryOrder = deriveCategoryOrder(menuItems);

  const sortedCategories: { name: string; position: number }[] = Object.keys(categoryGroups)
    .map((cat) => {
      // Always prioritize stored category order from PDF upload
      if (categoryOrder && Array.isArray(categoryOrder)) {
        const orderIndex = categoryOrder.findIndex(storedCat => 
          storedCat.toLowerCase() === cat.toLowerCase()
        );
        if (orderIndex >= 0) {
          return {
            name: cat,
            position: orderIndex
          };
        } else {
        }
      }
      
      // Use dynamically derived order from menu items
      const dynamicOrderIndex = dynamicCategoryOrder.findIndex(dynamicCat => 
        dynamicCat.toLowerCase() === cat.toLowerCase()
      );
      if (dynamicOrderIndex >= 0) {
        return {
          name: cat,
          position: dynamicOrderIndex
        };
      }
      
      // If no stored order, use alphabetical sorting to maintain consistency
      return {
        name: cat,
        // Put unknown categories at the end, sorted alphabetically
        position: 999 + cat.toLowerCase().localeCompare('')
      };
    })
    .sort((a, b) => a.position - b.position);


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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Categories Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Categories Management</span>
            <Button
              variant="outline"
              onClick={() => {
                setShowCategoriesManagement(!showCategoriesManagement);
              }}
            >
              {showCategoriesManagement ? (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Hide Categories
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Manage Categories
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            Reorder categories, add new ones, or reset to PDF order. Changes affect both menu management and customer ordering.
          </CardDescription>
        </CardHeader>
        
        {showCategoriesManagement && (
          <CardContent className="space-y-4">
            {/* Add New Category */}
            <div className="flex items-center space-x-2">
              <Input
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
                className="flex-1"
              />
              <Button
                onClick={addNewCategory}
                disabled={!newCategoryName.trim() || saving === "add-category"}
              >
                {saving === "add-category" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                Add Category
              </Button>
            </div>

            {/* Category Actions */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={resetToPdfOrder}
                disabled={!categoryOrder || !Array.isArray(categoryOrder)}
              >
                Reset to PDF Order
              </Button>
              <span className="text-sm text-gray-500">
                {categoryOrder ? `PDF order: ${categoryOrder.join(', ')}` : 'No PDF order available'}
              </span>
            </div>

            {/* Categories List */}
            <div className="space-y-2">
              <h4 className="font-medium">Current Categories ({sortedCategories.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {sortedCategories.map(({ name }) => {
                  const itemCount = categoryGroups[name]?.length || 0;
                  return (
                    <div
                      key={name}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{name}</span>
                        <span className="text-xs text-gray-500">({itemCount})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCategoryExpansion(name)}
                      >
                        {expandedCategories.has(name) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Existing Menu Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Menu ({menuItems.length} items)</span>
          </CardTitle>
          <CardDescription>
            {menuItems.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                <span className="text-xs">Select All</span>
              </div>
            )}
            Edit or remove existing menu items. Changes are saved automatically
            and will be live for customers instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading menu items...</p>
            </div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">
                No menu items found. Add some items above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {sortedCategories.map(({ name }) => {
                const isExpanded = expandedCategories.has(name);
                const itemCount = categoryGroups[name].length;
                
                return (
                  <div key={name} className="space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-lg border transition-colors"
                      onClick={() => toggleCategoryExpansion(name)}
                    >
                      <div className="flex items-center space-x-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        )}
                        <h3 className="font-semibold text-lg text-servio-purple">
                          {name}
                        </h3>
                        <span className="text-sm text-gray-500">({itemCount} items)</span>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="space-y-3 ml-6">
                        {categoryGroups[name].map((item: MenuItem) => (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-200 p-5 rounded-lg flex items-center justify-between shadow-sm hover:shadow-md group transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="mr-4"
                        />
                        <div className="flex-1">
                          {editingItemId === item.id ? (
                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                              <Input
                                value={editItemDraft?.name ?? item.name}
                                onChange={(e) => setEditItemDraft((draft: Partial<MenuItem> | null) => ({ ...draft, name: e.target.value }))}
                                className="w-40"
                                placeholder="Name"
                              />
                              <Input
                                value={editItemDraft?.category ?? item.category}
                                onChange={(e) => setEditItemDraft((draft: Partial<MenuItem> | null) => ({ ...draft, category: e.target.value }))}
                                className="w-32"
                                placeholder="Category"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                value={editItemDraft?.price ?? item.price}
                                onChange={(e) => setEditItemDraft((draft: Partial<MenuItem> | null) => ({ ...draft, price: Number(e.target.value) }))}
                                className="w-24"
                                placeholder="Price"
                              />
                              <Input
                                value={editItemDraft?.description ?? item.description ?? ""}
                                onChange={(e) => setEditItemDraft((draft: Partial<MenuItem> | null) => ({ ...draft, description: e.target.value }))}
                                className="w-48"
                                placeholder="Description"
                              />
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={editItemDraft?.available ?? item.available}
                                  onCheckedChange={(checked) => setEditItemDraft((draft: Partial<MenuItem> | null) => ({ ...draft, available: checked }))}
                                />
                                <Label className="text-sm">{(editItemDraft?.available ?? item.available) ? "Available" : "Unavailable"}</Label>
                              </div>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (!editItemDraft) return;
                                  if (!window.confirm("Are you sure you want to save these changes?")) return;
                                  setSaving(item.id);
                                  await handleUpdateItem(item.id, editItemDraft);
                                  setEditingItemId(null);
                                  setEditItemDraft(null);
                                }}
                                disabled={saving === item.id}
                                className="ml-2"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingItemId(null); setEditItemDraft(null); }}
                                className="ml-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-3">
                              <h4 className="font-semibold text-lg">{item.name}</h4>
                              <span className="text-lg font-bold text-green-600">£{item.price.toFixed(2)}</span>
                              <span className="text-xs text-gray-500">{item.category}</span>
                              {item.description && <span className="text-xs text-gray-500">{item.description}</span>}
                              <span className="text-xs text-gray-500">{item.available ? "Available" : "Unavailable"}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={saving === item.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            {saving === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditItemDraft({
                                name: item.name,
                                price: item.price,
                                category: item.category,
                                description: item.description,
                                available: item.available,
                              });
                            }}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Edit
                          </Button>
                        </div>
                        </div>
                      ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Menu Items Section - Moved below the menu items */}
      <Card>
        <CardHeader>
          <CardTitle>Add Menu Items</CardTitle>
          <CardDescription>
            Add individual menu items to your venue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={(e) =>
                  setNewItem({ ...newItem, name: e.target.value })
                }
                placeholder="e.g., Cappuccino"
                disabled={saving === "add"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={newItem.category}
                onChange={(e) =>
                  setNewItem({ ...newItem, category: e.target.value })
                }
                placeholder="e.g., Coffee"
                disabled={saving === "add"}
                list="categories"
              />
              <datalist id="categories">
                {sortedCategories.map(({ name }) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (£) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={newItem.price}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    price: Number.parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
                disabled={saving === "add"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="available">Availability</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="available"
                  checked={newItem.available}
                  onCheckedChange={(checked) =>
                    setNewItem({ ...newItem, available: checked })
                  }
                  disabled={saving === "add"}
                />
                <Label htmlFor="available">Available for ordering</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={newItem.description}
              onChange={(e) =>
                setNewItem({ ...newItem, description: e.target.value })
              }
              placeholder="Optional description of the item"
              disabled={saving === "add"}
            />
          </div>

          <Button
            onClick={handleAddItem}
            disabled={saving === "add" || loading}
            className="w-full"
            data-add-item-button
          >
            {saving === "add" ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            Add Item
          </Button>
        </CardContent>
      </Card>

      {/* Sticky batch action bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t z-50 shadow-lg flex items-center justify-center gap-4 py-3">
          <span className="font-medium">{selectedItems.length} selected</span>
          <Button onClick={() => handleBatchAction("unavailable")}>Mark Unavailable</Button>
          <Button onClick={() => handleBatchAction("category")}>Change Category</Button>
          <Button onClick={() => handleBatchAction("price")}>Bulk Price Edit</Button>
          <Button variant="destructive" onClick={() => handleBatchAction("delete")}>Delete</Button>
        </div>
      )}
      {/* Batch edit modal */}
      {batchAction && (
        <Dialog open={!!batchAction} onOpenChange={v => !v && setBatchAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Batch {batchAction === "edit" ? "Edit" : batchAction === "unavailable" ? "Mark Unavailable" : batchAction === "category" ? "Change Category" : batchAction === "price" ? "Bulk Price Edit" : "Delete"}</DialogTitle>
            </DialogHeader>
            {batchAction === "category" && (
              <Input placeholder="New category" value={batchEditValue || ""} onChange={e => setBatchEditValue(e.target.value)} />
            )}
            {batchAction === "price" && (
              <Input placeholder="New price" type="number" value={batchEditValue || ""} onChange={e => setBatchEditValue(e.target.value)} />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setBatchAction(null)}>Cancel</Button>
              <Button onClick={confirmBatchEdit} disabled={saving === "batch"}>{saving === "batch" ? "Saving..." : "Confirm"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {batchEditOpen && (
        <Dialog open={batchEditOpen} onOpenChange={setBatchEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Batch Edit Categories</DialogTitle>
              <DialogDescription>Edit categories for multiple menu items at once.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {batchEditItems.map(item => (
                <div key={item.id} className="flex items-center gap-4">
                  <span className="w-40 truncate">{item.name}</span>
                  <Input
                    value={item.category}
                    onChange={e => handleBatchEditChange(item.id, { category: e.target.value })}
                    className="w-48"
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setBatchEditOpen(false)}>Cancel</Button>
              <Button onClick={saveBatchEdit} disabled={saving === "batch"}>{saving === "batch" ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
