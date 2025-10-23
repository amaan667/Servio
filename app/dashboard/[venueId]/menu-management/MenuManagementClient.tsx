"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Plus, Edit, Trash2, ShoppingBag, Trash, ChevronDown, ChevronRight, Save, Eye, Settings, Upload, Grid, GripVertical, Palette } from "lucide-react";
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

export default function MenuManagementClient({ venueId, canEdit = true }: { venueId: string; canEdit?: boolean }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    available: true
  });
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('manage');
  const [showCategories, setShowCategories] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('pdf');
  const { toast } = useToast();

  const { menuItems, loading, categoryOrder, setMenuItems, loadMenuItems } = useMenuItems(venueId);
  const { designSettings, setDesignSettings, isSavingDesign, saveDesignSettings } = useDesignSettings(venueId);
  const { handleDragEnd } = useDragAndDrop(menuItems, setMenuItems);
  const { isUploadingLogo, handleLogoUpload } = useLogoUpload(venueId, designSettings, setDesignSettings);

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
        const categoryItems = menuItems.filter(item => item.category === formData.category.trim());
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
        created_at: new Date().toISOString()
      };

      let result;
      if (editingItem) {
        result = await supabase
          .from('menu_items')
          .update(itemData)
          .eq('id', editingItem.id);
      } else {
        result = await supabase
          .from('menu_items')
          .insert(itemData);
      }

      if (result.error) {
        throw result.error;
      }

      toast({
        title: editingItem ? "Menu item updated" : "Menu item added",
        description: `"${formData.name}" has been ${editingItem ? 'updated' : 'added'} successfully.`,
      });

      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        available: true
      });
      setIsAddModalOpen(false);
      setEditingItem(null);
      
      await loadMenuItems();
    } catch (error) {

      toast({
        title: "Error",
        description: error.message || "Failed to save menu item",
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
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', item.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Menu item deleted",
        description: `"${item.name}" has been deleted successfully.`,
      });

      await loadMenuItems();
    } catch (error) {

      toast({
        title: "Error",
        description: error.message || "Failed to delete menu item",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      available: item.is_available
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
    const categories = Array.from(new Set(menuItems.map(item => item.category)));
    if (categoryOrder) {
      return categoryOrder.filter(cat => categories.includes(cat));
    }
    return categories.sort();
  };

  const getItemsByCategory = (category: string) => {
    return menuItems
      .filter(item => item.category === category)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  };

  const clearAllMenu = async () => {
    if (!confirm('Are you sure you want to clear all menu items? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('venue_id', venueId);

      if (error) {
        throw error;
      }

      toast({
        title: "Menu cleared",
        description: "All menu items have been cleared successfully.",
      });

      await loadMenuItems();
    } catch (error) {

      toast({
        title: "Error",
        description: error.message || "Failed to clear menu",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Removed loading check - render immediately with empty state

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-1 mb-6 bg-muted p-1 rounded-lg w-full sm:w-fit">
        <Button
          variant={activeTab === 'manage' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('manage')}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Settings className="h-4 w-4" />
          <span>Manage</span>
        </Button>
        <Button
          variant={activeTab === 'design' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('design')}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Palette className="h-4 w-4" />
          <span>Design</span>
        </Button>
        <Button
          variant={activeTab === 'preview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('preview')}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Eye className="h-4 w-4" />
          <span>Preview</span>
        </Button>
      </div>

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload Menu</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MenuUploadCard venueId={venueId} onSuccess={() => loadMenuItems()} />
            </CardContent>
          </Card>

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
                    {showCategories ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>{showCategories ? 'Hide' : 'Manage'}</span>
                  </Button>
                </CardTitle>
              </CardHeader>
              {showCategories && (
                <CardContent>
                  <CategoriesManagement venueId={venueId} onCategoriesUpdate={() => loadMenuItems()} />
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
                        <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
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
                      <span>{isClearing ? 'Clearing...' : 'Clear All'}</span>
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
                  <p className="text-muted-foreground mb-4">Get started by adding your first menu item or uploading a menu.</p>
                  <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add First Item</span>
                  </Button>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="space-y-4">
                    {getCategories().map(category => (
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
                                className={`border-t ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
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
                                            snapshot.isDragging ? 'bg-blue-50 border-l-4 border-blue-500 shadow-md' : ''
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
                                                <h4 className="font-medium text-foreground">{item.name}</h4>
                                                {!item.is_available && (
                                                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Unavailable</span>
                                                )}
                                              </div>
                                              {item.description && (
                                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                              )}
                                              <p className="text-sm font-medium text-foreground mt-1">{formatPriceWithCurrency(item.price, '£')}</p>
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
      )}

      {/* Design Tab */}
      {activeTab === 'design' && (
        <div className="space-y-6">
          <ThemeSettings
            designSettings={designSettings}
            setDesignSettings={setDesignSettings}
          />

          <LayoutSettings
            designSettings={designSettings}
            setDesignSettings={setDesignSettings}
          />

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
              onClick={saveDesignSettings}
              disabled={isSavingDesign}
              className="flex items-center space-x-2 w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              <span>{isSavingDesign ? 'Saving...' : 'Save Design'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <PreviewControls
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            venueId={venueId}
            onShare={async () => {
              const shareUrl = `${window.location.origin}/order/${venueId}`;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: 'View Our Menu',
                    text: 'Check out our menu!',
                    url: shareUrl,
                  });
                } catch (err) {

                }
              } else {
                await navigator.clipboard.writeText(shareUrl);
                toast({
                  title: 'Link copied!',
                  description: 'Menu link has been copied to your clipboard',
                });
              }
            }}
          />

          {menuItems.length === 0 ? (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items to preview</h3>
                  <p className="text-gray-500 mb-4">Upload a PDF menu in the Manage tab to see your styled menu preview.</p>
                  <Button onClick={() => setActiveTab('manage')} className="flex items-center space-x-2 mx-auto">
                    <Plus className="h-4 w-4" />
                    <span>Go to Manage</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : previewMode === 'pdf' ? (
            <EnhancedPDFMenuDisplay
              venueId={venueId}
              menuItems={menuItems}
              categoryOrder={categoryOrder}
              onAddToCart={() => {}}
              cart={[]}
              onRemoveFromCart={() => {}}
              onUpdateQuantity={() => {}}
              isOrdering={false}
            />
          ) : previewMode === 'styled' ? (
            <MenuPreview
              venueId={venueId}
              menuItems={menuItems}
              categoryOrder={categoryOrder}
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-8">
                  {(() => {
                    const categories = Array.from(new Set(menuItems.map((i) => i.category)));
                    const sortedCats = categoryOrder 
                      ? categories.sort((a,b) => {
                          const orderA = categoryOrder.findIndex(c => c.toLowerCase() === a.toLowerCase());
                          const orderB = categoryOrder.findIndex(c => c.toLowerCase() === b.toLowerCase());
                          if (orderA >= 0 && orderB >= 0) return orderA - orderB;
                          if (orderA >= 0) return -1;
                          if (orderB >= 0) return 1;
                          return 0;
                        })
                      : categories.sort();
                    
                    return sortedCats.map(category => (
                      <div key={category} className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-gray-200 pb-2">
                          {category}
                        </h2>
                        <div className="space-y-3">
                          {menuItems
                            .filter(item => item.category === category && item.is_available)
                            .map(item => (
                              <div key={item.id} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                  {item.description && (
                                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                  )}
                                </div>
                                <span className="text-lg font-semibold text-purple-600 ml-4">
                                  £{item.price.toFixed(2)}
                                </span>
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
        </div>
      )}
    </div>
  );
}
