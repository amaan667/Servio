"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit, Trash2, ShoppingBag, Trash, ChevronDown, ChevronRight, Save, Eye, Download, Palette, Layout, Settings, Upload, Image, Palette as PaletteIcon, Type, Grid, List } from "lucide-react";
import { MenuUploadCard } from "@/components/MenuUploadCard";
import { CategoriesManagement } from "@/components/CategoriesManagement";
import { useToast } from "@/hooks/use-toast";

interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  created_at: string;
}

export default function MenuManagementClient({ venueId }: { venueId: string }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
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
  const [activeTab, setActiveTab] = useState<'manage' | 'design' | 'preview'>('manage');
  const [showCategories, setShowCategories] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (venueId) {
      loadMenuItems();
    }
  }, [venueId]);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading menu items:', error);
        toast({
          title: "Error",
          description: "Failed to load menu items",
          variant: "destructive",
        });
        return;
      }

      setMenuItems(items || []);
      
      // Load category order
      const { data: uploadData, error: uploadError } = await supabase
        .from('menu_uploads')
        .select('category_order')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!uploadError && uploadData && uploadData.length > 0) {
        setCategoryOrder(uploadData[0].category_order);
      }
    } catch (error) {
      console.error('Error in loadMenuItems:', error);
      toast({
        title: "Error",
        description: "Failed to load menu items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
      const itemData = {
        venue_id: venueId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        category: formData.category.trim(),
        is_available: formData.available,
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

      // Reset form
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        available: true
      });
      setIsAddModalOpen(false);
      setEditingItem(null);
      
      // Reload menu items
      await loadMenuItems();
    } catch (error: any) {
      console.error('Error saving menu item:', error);
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
    } catch (error: any) {
      console.error('Error deleting menu item:', error);
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
    return menuItems.filter(item => item.category === category);
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
    } catch (error: any) {
      console.error('Error clearing menu:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear menu",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading menu items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'manage' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('manage')}
          className="flex items-center space-x-2"
        >
          <Settings className="h-4 w-4" />
          <span>Manage</span>
        </Button>
        <Button
          variant={activeTab === 'design' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('design')}
          className="flex items-center space-x-2"
        >
          <Palette className="h-4 w-4" />
          <span>Design</span>
        </Button>
        <Button
          variant={activeTab === 'preview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('preview')}
          className="flex items-center space-x-2"
        >
          <Eye className="h-4 w-4" />
          <span>Preview</span>
        </Button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Upload Menu Section */}
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

          {/* Categories Management */}
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

          {/* Menu Items Management */}
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
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Item Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            placeholder="e.g., Margherita Pizza"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder="Describe the item..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="price">Price</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Input
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                            placeholder="e.g., Pizza, Drinks, Desserts"
                            required
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <ToggleSwitch
                            checked={formData.available}
                            onCheckedChange={(checked) => setFormData({...formData, available: checked})}
                          />
                          <Label>Available</Label>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">
                            <Save className="h-4 w-4 mr-2" />
                            {editingItem ? 'Update' : 'Add'} Item
                          </Button>
                        </div>
                      </form>
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
                        <div className="border-t">
                          {getItemsByCategory(category).map(item => (
                            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/25">
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
                                <p className="text-sm font-medium text-foreground mt-1">${item.price.toFixed(2)}</p>
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
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'design' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PaletteIcon className="h-5 w-5" />
              <span>Menu Design</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Design customization options will be available here.</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Menu Preview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Menu preview will be available here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}