"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabaseBrowser as createClient } from "@/lib/supabase";
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
  Upload,
  Grid,
  GripVertical,
  Palette,
  Info,
} from "lucide-react";
import { MenuUploadCard } from "@/components/MenuUploadCard";
import { CategoriesManagement } from "@/components/CategoriesManagement";
import { MenuPreview } from "@/components/MenuPreview";
import { EnhancedPDFMenuDisplay } from "@/components/EnhancedPDFMenuDisplay";
import { useToast } from "@/hooks/use-toast";
import { formatPriceWithCurrency } from "@/lib/pricing-utils";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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

// Utils
import { loadFontForFamily } from "./utils/fontLoader";

// Types
import { MenuItem, ActiveTab, PreviewMode } from "./types";

export default function MenuManagementClient({
  venueId,
  canEdit: _canEdit = true,
}: {
  venueId: string;
  canEdit?: boolean;
}) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
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
  const [showCategories, setShowCategories] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("pdf");
  const [designRefreshKey, setDesignRefreshKey] = useState(0); // Triggers preview refresh
  const { toast } = useToast();
  const router = useRouter();

  const { menuItems, loading, categoryOrder, setMenuItems, loadMenuItems } = useMenuItems(venueId);
  const { designSettings, setDesignSettings, isSavingDesign, saveDesignSettings } =
    useDesignSettings(venueId);
  const { handleDragEnd } = useDragAndDrop(menuItems, setMenuItems);
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
    loadFontForFamily(designSettings.font_family);
  }, [designSettings.font_family]);

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
    } catch (_error) {
      toast({
        title: "Error",
        description: _error instanceof Error ? _error.message : "Failed to save menu item",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

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
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      category: item.category,
      available: item.is_available,
    });
    setIsAddModalOpen(true);
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
    if (!confirm("Are you sure you want to clear all menu items? This action cannot be undone.")) {
      return;
    }

    try {
      setIsClearing(true);
      const supabase = createClient();
      const { error } = await supabase.from("menu_items").delete().eq("venue_id", venueId);

      if (error) {
        throw error;
      }

      toast({
        title: "Menu cleared",
        description: "All menu items have been cleared successfully.",
      });

      await loadMenuItems();
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
              onSuccess={() => {
                console.log("[MENU MANAGEMENT] Upload successful - refreshing data");
                // Refresh menu items list (client-side)
                loadMenuItems();
                // Force router refresh to update server-rendered dashboard stats
                router.refresh();
                console.log("[MENU MANAGEMENT] Router refreshed - dashboard stats should update");
              }}
            />

            {menuItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Grid className="h-5 w-5" />
                      <span>Categories</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowCategories(!showCategories)}
                      className="flex items-center space-x-2"
                    >
                      {showCategories ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span>{showCategories ? "Hide" : "Manage"}</span>
                    </Button>
                  </CardTitle>
                </CardHeader>
                {showCategories && (
                  <CardContent>
                    <CategoriesManagement
                      venueId={venueId}
                      onCategoriesUpdate={() => loadMenuItems()}
                    />
                  </CardContent>
                )}
              </Card>
            )}

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
                        <span>{isClearing ? "Clearing..." : "Clear All"}</span>
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
                    <div className="space-y-4">
                      {getCategories().map((category) => (
                        <div key={category} className="border rounded-lg">
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleCategory(category)}
                          >
                            <div className="flex items-center space-x-2">
                              {expandedCategories.has(category) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <h3 className="font-medium text-foreground">{category}</h3>
                              <span className="text-sm text-muted-foreground">
                                ({getItemsByCategory(category).length} items)
                              </span>
                            </div>
                          </div>
                          {expandedCategories.has(category) && (
                            <Droppable droppableId={category}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`border-t ${snapshot.isDraggingOver ? "bg-blue-50" : ""}`}
                                >
                                  {getItemsByCategory(category)
                                    .sort((a, b) => (a.position || 0) - (b.position || 0))
                                    .map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`flex items-center justify-between p-4 hover:bg-muted/25 transition-colors ${
                                              snapshot.isDragging
                                                ? "bg-blue-50 border-l-4 border-blue-500 shadow-md"
                                                : ""
                                            }`}
                                          >
                                            <div className="flex items-center space-x-2 flex-1">
                                              <div
                                                {...provided.dragHandleProps}
                                                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                              >
                                                <GripVertical className="h-5 w-5" />
                                              </div>
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
                      ))}
                    </div>
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
              menuItems={menuItems as any}
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
                            .filter((item) => item.category === category && item.is_available)
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
    </div>
  );
}
