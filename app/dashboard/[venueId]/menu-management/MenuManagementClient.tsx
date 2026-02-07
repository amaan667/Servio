"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { safeRemoveItem } from "@/app/order/utils/safeStorage";
import {
  Plus,
  Edit,
  Trash2,
  ShoppingBag,
  Trash,
  ChevronDown,
  ChevronRight,
  Save,
  Eye,
  Settings,
  GripVertical,
  Palette,
  ImageIcon,
} from "lucide-react";
import { MenuUploadCard } from "@/components/MenuUploadCard";
import { MenuPreview } from "@/components/MenuPreview";
import { EnhancedPDFMenuDisplay } from "@/components/EnhancedPDFMenuDisplay";
import { useToast } from "@/hooks/use-toast";
import { formatPriceWithCurrency } from "@/lib/pricing-utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

// Hooks
import { useMenuItems } from "./hooks/useMenuItems";
import { useDesignSettings } from "./hooks/useDesignSettings";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useLogoUpload } from "./hooks/useLogoUpload";

// Components
import { MenuItemForm } from "./components/MenuItemForm";
import { ThemeSettings } from "./components/ThemeSettings";
import { LayoutSettings } from "./components/LayoutSettings";
import { BrandingSettings } from "./components/BrandingSettings";
import { PreviewControls } from "./components/PreviewControls";
import { EditItemModal } from "@/components/menu-management/EditItemModal";

// Utils
import { loadFontForFamily } from "./utils/fontLoader";
import { getMenuImageDisplayUrl } from "@/lib/menu-image-url";

// Types
import { MenuItem, ActiveTab, PreviewMode } from "./types";

export default function MenuManagementClient({
  venueId,
  initialMenuItems,
}: {
  venueId: string;
  initialMenuItems?: MenuItem[];
}) {
  const searchParams = useSearchParams();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    available: true,
  });
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("manage");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("pdf");
  const [designRefreshKey, setDesignRefreshKey] = useState(0); // Triggers preview refresh
  const { toast } = useToast();
  const router = useRouter();

  const { menuItems, loading, categoryOrder, setCategoryOrder, setMenuItems, loadMenuItems } =
    useMenuItems(venueId, initialMenuItems);

  // Log component state changes
  useEffect(() => {
    /* Intentionally empty */
  }, [venueId, activeTab, menuItems.length, loading, isClearing, categoryOrder]);

  // Log tab changes
  useEffect(() => {
    /* Intentionally empty */
  }, [activeTab, venueId, menuItems.length]);
  const { designSettings, setDesignSettings, isSavingDesign, saveDesignSettings } =
    useDesignSettings(venueId);
  const { handleItemDragEnd, handleCategoryDragEnd } = useDragAndDrop(
    menuItems,
    setMenuItems,
    categoryOrder,
    setCategoryOrder,
    venueId
  );

  // Unified drag handler that detects if we're dragging a category or item
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    // Check if we're dragging a category (draggableId starts with "category-")
    if (result.draggableId.startsWith("category-")) {
      await handleCategoryDragEnd(result);
    } else {
      // Dragging an item
      await handleItemDragEnd(result);
    }
  };
  const { isUploadingLogo, handleLogoUpload } = useLogoUpload(
    venueId,
    designSettings,
    setDesignSettings
  );

  // Wrapper for saveDesignSettings that triggers preview refresh
  const handleSaveDesign = async () => {
    await saveDesignSettings();
    setDesignRefreshKey((prev) => prev + 1); // Force preview to refresh
  };

  useEffect(() => {
    // CRITICAL LOG: Menu builder page opened
    // Menu items loaded
  }, []); // Run once on mount

  useEffect(() => {
    loadFontForFamily(designSettings.font_family);
  }, [designSettings.font_family]);

  // Handle AI assistant navigation
  useEffect(() => {
    const itemId = searchParams?.get("itemId");

    if (itemId && menuItems.length > 0) {
      const item = menuItems.find((i) => i.id === itemId);
      if (item) {
        setEditingItem(item);
        setIsEditModalOpen(true);
        // Clear URL params after opening modal
        router.replace(`/dashboard/${venueId}/menu-management`, { scroll: false });
      }
    }
  }, [searchParams, menuItems, venueId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!venueId) {
      toast({
        title: "Error",
        description: "Venue not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const supabase = createClient();

      let position = 0;
      if (!editingItem) {
        const categoryItems = menuItems.filter(
          (item) => item.category === formData.category.trim()
        );
        position = categoryItems.length;
      }

      const itemData = {
        venue_id: venueId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        category: formData.category.trim(),
        is_available: formData.available,
        position: editingItem ? editingItem.position : position,
        created_at: new Date().toISOString(),
      };

      let result;
      if (editingItem) {
        result = await supabase.from("menu_items").update(itemData).eq("id", editingItem.id);
      } else {
        result = await supabase.from("menu_items").insert(itemData);
      }

      if (result.error) {
        throw result.error;
      }

      toast({
        title: editingItem ? "Menu item updated" : "Menu item added",
        description: `"${formData.name}" has been ${editingItem ? "updated" : "added"} successfully.`,
      });

      setFormData({
        name: "",
        description: "",
        price: "",
        category: "",
        available: true,
      });
      setIsAddModalOpen(false);
      setEditingItem(null);

      await loadMenuItems();

      // Dispatch event with updated count after menu items are loaded
      // Use a small delay to ensure state has updated
      setTimeout(async () => {
        if (typeof window !== "undefined") {
          // Get the actual count from the database
          const { fetchMenuItemCount } = await import("@/lib/counts/unified-counts");
          const newCount = await fetchMenuItemCount(venueId);
          window.dispatchEvent(
            new CustomEvent("menuItemsChanged", {
              detail: { venueId, count: newCount },
            })
          );
          // Also dispatch menuChanged for backward compatibility
          window.dispatchEvent(
            new CustomEvent("menuChanged", {
              detail: { venueId, action: editingItem ? "updated" : "created", itemCount: newCount },
            })
          );
        }
      }, 100);
    } catch (_error) {
      toast({
        title: "Error",
        description: _error instanceof Error ? _error.message : "Failed to save menu item",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (item: MenuItem) => {
    const confirmDelete = confirm(`Are you sure you want to delete "${item.name}"?`);
    if (!confirmDelete) { toast({ description: "Delete cancelled" }); return; }

    try {
      const supabase = createClient();
      const { error } = await supabase.from("menu_items").delete().eq("id", item.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Menu item deleted",
        description: `"${item.name}" has been deleted successfully.`,
      });

      await loadMenuItems();

      // Dispatch event with updated count after menu items are loaded
      // Use a small delay to ensure state has updated
      setTimeout(async () => {
        if (typeof window !== "undefined") {
          // Get the actual count from the database
          const { fetchMenuItemCount } = await import("@/lib/counts/unified-counts");
          const newCount = await fetchMenuItemCount(venueId);
          window.dispatchEvent(
            new CustomEvent("menuItemsChanged", {
              detail: { venueId, count: newCount },
            })
          );
          // Also dispatch menuChanged for backward compatibility
          window.dispatchEvent(
            new CustomEvent("menuChanged", {
              detail: { venueId, action: "deleted", itemCount: newCount },
            })
          );
        }
      }, 100);
    } catch (_error) {
      toast({
        title: "Error",
        description: _error instanceof Error ? _error.message : "Failed to delete menu item",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategories = () => {
    const uniqueCategories = Array.from(new Set(menuItems.map((item) => item.category)));

    // Always use categoryOrder from database if available
    if (categoryOrder && categoryOrder.length > 0) {
      // Use PDF order, add any new categories at the end
      const ordered = categoryOrder.filter((cat) => uniqueCategories.includes(cat));
      const newCategories = uniqueCategories.filter((cat) => !categoryOrder.includes(cat));
      return [...ordered, ...newCategories];
    }

    // Fallback: extract order from item positions
    const categoriesInOrder: string[] = [];
    const seen = new Set<string>();

    menuItems
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .forEach((item) => {
        if (item.category && !seen.has(item.category)) {
          categoriesInOrder.push(item.category);
          seen.add(item.category);
        }
      });

    return categoriesInOrder;
  };

  const getItemsByCategory = (category: string) => {
    return menuItems
      .filter((item) => item.category === category)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  };

  const clearAllMenu = async () => {
    // CRITICAL LOG: Clear menu button clicked

    const confirmClear = confirm("Are you sure you want to clear the entire menu? This action cannot be undone.");
    if (!confirmClear) { toast({ description: "Clear cancelled" }); return; }

    try {
      setIsClearing(true);

      const requestBody = { venue_id: venueId };

      const response = await fetch("/api/menu/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(errorData.error || "Failed to clear menu");
      }

      const result = await response.json();

      // CRITICAL LOG: Clear menu API response

      if (result.ok) {
        toast({
          title: "Menu cleared",
          description: `All menu items, categories, and options have been cleared successfully.`,
        });

        await loadMenuItems();

        // Clear dashboard cache to force fresh count
        if (typeof window !== "undefined") {
          safeRemoveItem(sessionStorage, `dashboard_stats_${venueId}`);
          safeRemoveItem(sessionStorage, `dashboard_counts_${venueId}`);

          // Dispatch custom event to trigger dashboard refresh
          window.dispatchEvent(
            new CustomEvent("menuChanged", {
              detail: { venueId, action: "cleared" },
            })
          );
        }

        // Force router refresh to update server-rendered data
        router.refresh();

        // CRITICAL LOG: Clear menu success
      } else {
        throw new Error(result.error || "Failed to clear menu");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: _error instanceof Error ? _error.message : "Failed to clear menu",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Removed loading check - render immediately with empty state

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Manage
          </TabsTrigger>
          <TabsTrigger value="design" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Design
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-6 mt-6">
          <div className="space-y-6">
            {/* Unified Menu Upload - Handles PDF + Optional URL */}
            <MenuUploadCard
              venueId={venueId}
              menuItemCount={menuItems.length}
              onSuccess={async () => {
                // Refresh menu items list (client-side)
                await loadMenuItems();

                // Clear dashboard cache to force fresh count
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem(`dashboard_stats_${venueId}`);
                  sessionStorage.removeItem(`dashboard_counts_${venueId}`);

                  // Dispatch custom event to trigger dashboard refresh
                  window.dispatchEvent(
                    new CustomEvent("menuChanged", {
                      detail: { venueId, action: "uploaded" },
                    })
                  );
                }

                // Force router refresh to update server-rendered dashboard stats
                router.refresh();
              }}
            />

            {/* Categories section removed - now integrated into Menu Items with drag-and-drop */}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingBag className="h-5 w-5" />
                    <span>Menu Items ({menuItems.length})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center space-x-2">
                          <Plus className="h-4 w-4" />
                          <span>Add Item</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>
                            {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                          </DialogTitle>
                        </DialogHeader>
                        <MenuItemForm
                          formData={formData}
                          setFormData={setFormData}
                          editingItem={editingItem}
                          onSubmit={handleSubmit}
                          onCancel={() => setIsAddModalOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                    {menuItems.length > 0 && (
                      <Button
                        variant="destructive"
                        onClick={clearAllMenu}
                        disabled={isClearing}
                        className="flex items-center space-x-2"
                      >
                        <Trash className="h-4 w-4" />
                        <span>{isClearing ? "Clearing..." : "Clear Menu"}</span>
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {menuItems.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No menu items yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Get started by adding your first menu item or uploading a menu.
                    </p>
                    <Button
                      onClick={() => setIsAddModalOpen(true)}
                      className="flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add First Item</span>
                    </Button>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    {/* Draggable Categories */}
                    <Droppable droppableId="categories" type="CATEGORY">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="space-y-4"
                        >
                          {getCategories().map((category, categoryIndex) => (
                            <Draggable
                              key={category}
                              draggableId={`category-${category}`}
                              index={categoryIndex}
                            >
                              {(categoryProvided, categorySnapshot) => (
                                <div
                                  ref={categoryProvided.innerRef}
                                  {...categoryProvided.draggableProps}
                                  className={cn(
                                    "border rounded-lg",
                                    categorySnapshot.isDragging &&
                                      "shadow-lg ring-2 ring-purple-500 bg-purple-50"
                                  )}
                                >
                                  {/* Category Header with Drag Handle */}
                                  <div className="flex items-center justify-between p-4 hover:bg-muted/50 bg-gradient-to-r from-purple-50 to-transparent">
                                    <div className="flex items-center space-x-3 flex-1">
                                      {/* Category Drag Handle */}
                                      <div
                                        {...categoryProvided.dragHandleProps}
                                        className="cursor-grab active:cursor-grabbing text-purple-500 hover:text-purple-700"
                                        title="Drag to reorder category"
                                      >
                                        <GripVertical className="h-5 w-5" />
                                      </div>

                                      {/* Expand/Collapse Icon */}
                                      <div
                                        onClick={() => toggleCategory(category)}
                                        className="cursor-pointer flex items-center space-x-2"
                                      >
                                        {expandedCategories.has(category) ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                        <h3 className="font-semibold text-foreground text-lg">
                                          {category}
                                        </h3>
                                        <span className="text-sm text-muted-foreground">
                                          ({getItemsByCategory(category).length} items)
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {expandedCategories.has(category) && (
                                    <Droppable droppableId={category}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.droppableProps}
                                          className={cn(
                                            "border-t",
                                            snapshot.isDraggingOver && "bg-blue-50"
                                          )}
                                        >
                                          {getItemsByCategory(category)
                                            .sort((a, b) => (a.position || 0) - (b.position || 0))
                                            .map((item, index) => (
                                              <Draggable
                                                key={item.id}
                                                draggableId={item.id}
                                                index={index}
                                              >
                                                {(provided, snapshot) => (
                                                  <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={cn(
                                                      "flex items-center justify-between p-4 hover:bg-muted/25 transition-colors",
                                                      snapshot.isDragging &&
                                                        "bg-blue-50 border-l-4 border-blue-500 shadow-md"
                                                    )}
                                                  >
                                                    <div className="flex items-center space-x-3 flex-1">
                                                      <div
                                                        {...provided.dragHandleProps}
                                                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                                      >
                                                        <GripVertical className="h-5 w-5" />
                                                      </div>

                                                      {/* IMAGE PREVIEW WITH HOVER */}
                                                      <HoverCard>
                                                        <HoverCardTrigger asChild>
                                                          <div className="w-16 h-16 flex-shrink-0 cursor-pointer">
                                                            {item.image_url ? (
                                                              <img
                                                                src={getMenuImageDisplayUrl(item.image_url)}
                                                                alt={item.name}
                                                                className="w-full h-full object-cover rounded border border-gray-200 hover:ring-2 hover:ring-purple-500 transition-all"
                                                                onError={(e) => {
                                                                  (
                                                                    e.target as HTMLImageElement
                                                                  ).src =
                                                                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23f3f4f6' width='64' height='64'/%3E%3C/svg%3E";
                                                                }}
                                                              />
                                                            ) : (
                                                              <div className="w-full h-full bg-gray-100 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-colors">
                                                                <ImageIcon className="w-6 h-6 text-gray-300" />
                                                              </div>
                                                            )}
                                                          </div>
                                                        </HoverCardTrigger>
                                                        {item.image_url && (
                                                          <HoverCardContent
                                                            className="w-80 p-2"
                                                            side="right"
                                                          >
                                                            <img
                                                              src={getMenuImageDisplayUrl(item.image_url)}
                                                              alt={item.name}
                                                              className="w-full h-auto rounded-lg"
                                                            />
                                                            <p className="text-sm text-muted-foreground mt-2 text-center">
                                                              {item.name}
                                                            </p>
                                                          </HoverCardContent>
                                                        )}
                                                      </HoverCard>

                                                      <div className="flex-1">
                                                        <div className="flex items-center space-x-2">
                                                          <h4 className="font-medium text-foreground">
                                                            {item.name}
                                                          </h4>
                                                          {!item.is_available && (
                                                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                                              Unavailable
                                                            </span>
                                                          )}
                                                        </div>
                                                        {item.description && (
                                                          <p className="text-sm text-muted-foreground mt-1">
                                                            {item.description}
                                                          </p>
                                                        )}
                                                        <p className="text-sm font-medium text-foreground mt-1">
                                                          {formatPriceWithCurrency(item.price, "£")}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(item)}
                                                      >
                                                        <Edit className="h-4 w-4" />
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(item)}
                                                      >
                                                        <Trash2 className="h-4 w-4" />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                )}
                                              </Draggable>
                                            ))}
                                          {provided.placeholder}
                                        </div>
                                      )}
                                    </Droppable>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="design" className="space-y-6 mt-6">
          <ThemeSettings designSettings={designSettings} setDesignSettings={setDesignSettings} />

          <LayoutSettings designSettings={designSettings} setDesignSettings={setDesignSettings} />

          <BrandingSettings
            designSettings={designSettings}
            setDesignSettings={setDesignSettings}
            onLogoUpload={handleLogoUpload}
            isUploadingLogo={isUploadingLogo}
          />

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 Changes will be visible in the Preview tab
            </div>
            <Button
              onClick={handleSaveDesign}
              disabled={isSavingDesign}
              className="flex items-center space-x-2 w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              <span>{isSavingDesign ? "Saving..." : "Save Design"}</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6 mt-6">
          <PreviewControls previewMode={previewMode} setPreviewMode={setPreviewMode} />

          {menuItems.length === 0 ? (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No menu items to preview
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Upload a PDF menu in the Manage tab to see your styled menu preview.
                  </p>
                  <Button
                    onClick={() => setActiveTab("manage")}
                    className="flex items-center space-x-2 mx-auto"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Go to Manage</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : previewMode === "pdf" ? (
            <EnhancedPDFMenuDisplay
              key={`pdf-${designRefreshKey}`}
              venueId={venueId}
              menuItems={menuItems}
              categoryOrder={categoryOrder}
              onAddToCart={() => {
                /* Empty */
              }}
              cart={[]}
              onRemoveFromCart={() => {
                /* Empty */
              }}
              onUpdateQuantity={() => {
                /* Empty */
              }}
              isOrdering={false}
            />
          ) : previewMode === "styled" ? (
            <MenuPreview
              key={`styled-${designRefreshKey}`}
              venueId={venueId}
              menuItems={menuItems as unknown as import("@/components/MenuPreview").MenuItem[]}
              categoryOrder={categoryOrder}
            />
          ) : (
            <Card key={`simple-${designRefreshKey}`}>
              <CardContent className="p-6">
                {/* Logo and Custom Heading */}
                {designSettings.logo_url && (
                  <div className="flex flex-col items-center justify-center mb-8">
                    <img
                      src={designSettings.logo_url}
                      alt={designSettings.venue_name || "Venue Logo"}
                      className="object-contain"
                      style={{
                        height: `${designSettings.logo_size_numeric || 200}px`,
                        maxWidth: "100%",
                      }}
                    />
                    {designSettings.custom_heading && (
                      <p
                        className="mt-4 text-center font-medium"
                        style={{
                          color: designSettings.primary_color,
                          fontSize: `${designSettings.font_size_numeric || 16}px`,
                        }}
                      >
                        {designSettings.custom_heading}
                      </p>
                    )}
                  </div>
                )}

                {designSettings.venue_name && !designSettings.logo_url && (
                  <div className="text-center mb-8">
                    <h1
                      className="font-bold"
                      style={{
                        fontSize: `${(designSettings.font_size_numeric || 16) + 12}px`,
                        color: designSettings.primary_color,
                      }}
                    >
                      {designSettings.venue_name}
                    </h1>
                  </div>
                )}

                <div className="space-y-8">
                  {(() => {
                    const categories = Array.from(new Set(menuItems.map((i) => i.category)));
                    const sortedCats = categoryOrder
                      ? categories.sort((a, b) => {
                          const orderA = categoryOrder.findIndex(
                            (c) => c.toLowerCase() === a.toLowerCase()
                          );
                          const orderB = categoryOrder.findIndex(
                            (c) => c.toLowerCase() === b.toLowerCase()
                          );
                          if (orderA >= 0 && orderB >= 0) return orderA - orderB;
                          if (orderA >= 0) return -1;
                          if (orderB >= 0) return 1;
                          return 0;
                        })
                      : categories.sort();

                    return sortedCats.map((category) => (
                      <div key={category} className="space-y-4">
                        <h2
                          className="text-2xl font-bold border-b-2 pb-2"
                          style={{
                            color: designSettings.primary_color,
                            borderColor: designSettings.secondary_color,
                            fontFamily: designSettings.font_family,
                          }}
                        >
                          {category}
                        </h2>
                        <div className="space-y-3">
                          {menuItems
                            // Show ALL items (not filtered by is_available) to match dashboard count
                            .filter((item) => item.category === category)
                            .map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex-1">
                                  <h3
                                    className="font-semibold"
                                    style={{
                                      fontFamily: designSettings.font_family,
                                      fontSize: `${designSettings.font_size_numeric || 16}px`,
                                    }}
                                  >
                                    {item.name}
                                  </h3>
                                  {designSettings.show_descriptions && item.description && (
                                    <p
                                      className="text-gray-600 mt-1 italic"
                                      style={{
                                        fontSize: `${(designSettings.font_size_numeric || 16) - 2}px`,
                                        fontFamily: designSettings.font_family,
                                      }}
                                    >
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                                {designSettings.show_prices && (
                                  <span
                                    className="text-lg font-semibold ml-4"
                                    style={{
                                      color: designSettings.primary_color,
                                      fontFamily: designSettings.font_family,
                                    }}
                                  >
                                    £{item.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Item Modal */}
      <EditItemModal
        item={editingItem}
        venueId={venueId}
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        onSuccess={() => {
          loadMenuItems();
        }}
      />
    </div>
  );
}
