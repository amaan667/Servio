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
import { ArrowLeft, Plus, Edit, Trash2, ShoppingBag, Trash, ChevronDown, ChevronRight, Save, Eye, Download, Palette, Layout, Settings } from "lucide-react";
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

export default function MenuBuilderClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    available: true
  });
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'manage' | 'preview'>('design');
  const { toast } = useToast();
  const router = useRouter();

  // Handle venue ID format - the actual venue_id in database has 'venue-' prefix
  const transformedVenueId = venueId.startsWith('venue-') ? venueId : `venue-${venueId}`;

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', transformedVenueId)
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
    } catch (error) {
      console.error('Error loading menu items:', error);
      toast({
        title: "Error",
        description: "Failed to load menu items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryOrder = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('venue_settings')
        .select('category_order')
        .eq('venue_id', transformedVenueId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading category order:', error);
        return;
      }

      if (data?.category_order) {
        setCategoryOrder(data.category_order);
      }
    } catch (error) {
      console.error('Error loading category order:', error);
    }
  };

  useEffect(() => {
    loadMenuItems();
    loadCategoryOrder();
  }, [transformedVenueId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.price.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .insert({
          venue_id: transformedVenueId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: parseFloat(formData.price),
          category: formData.category.trim() || 'Uncategorized',
          is_available: formData.available
        });

      if (error) {
        console.error('Error adding menu item:', error);
        toast({
          title: "Error",
          description: "Failed to add menu item",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Menu item added successfully",
      });

      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        available: true
      });
      setIsAddModalOpen(false);
      loadMenuItems();
    } catch (error) {
      console.error('Error adding menu item:', error);
      toast({
        title: "Error",
        description: "Failed to add menu item",
        variant: "destructive",
      });
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingItem || !formData.name.trim() || !formData.price.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: parseFloat(formData.price),
          category: formData.category.trim() || 'Uncategorized',
          is_available: formData.available
        })
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating menu item:', error);
        toast({
          title: "Error",
          description: "Failed to update menu item",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Menu item updated successfully",
      });

      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        available: true
      });
      loadMenuItems();
    } catch (error) {
      console.error('Error updating menu item:', error);
      toast({
        title: "Error",
        description: "Failed to update menu item",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting menu item:', error);
        toast({
          title: "Error",
          description: "Failed to delete menu item",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Menu item deleted successfully",
      });

      loadMenuItems();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      toast({
        title: "Error",
        description: "Failed to delete menu item",
        variant: "destructive",
      });
    }
  };

  const handleClearAllItems = async () => {
    if (!confirm('Are you sure you want to delete ALL menu items? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('venue_id', transformedVenueId);

      if (error) {
        console.error('Error clearing menu items:', error);
        toast({
          title: "Error",
          description: "Failed to clear menu items",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "All menu items cleared successfully",
      });

      loadMenuItems();
    } catch (error) {
      console.error('Error clearing menu items:', error);
      toast({
        title: "Error",
        description: "Failed to clear menu items",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const startEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      available: item.is_available
    });
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      available: true
    });
  };

  const getCategories = () => {
    const categories = [...new Set(menuItems.map(item => item.category))];
    return categoryOrder ? 
      categories.sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a);
        const bIndex = categoryOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }) : 
      categories.sort();
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

  const getItemsByCategory = (category: string) => {
    return menuItems.filter(item => item.category === category);
  };

  const exportMenu = () => {
    const menuData = {
      venue: venueName,
      venueId: transformedVenueId,
      exportedAt: new Date().toISOString(),
      categories: getCategories().map(category => ({
        name: category,
        items: getItemsByCategory(category).map(item => ({
          name: item.name,
          description: item.description,
          price: item.price,
          available: item.is_available
        }))
      }))
    };

    const dataStr = JSON.stringify(menuData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${venueName.replace(/\s+/g, '_')}_menu_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Menu exported successfully",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/${venueId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={activeTab === 'design' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('design')}
            className="flex items-center gap-2"
          >
            <Palette className="h-4 w-4" />
            Design
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('manage')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Manage
          </Button>
          <Button
            variant={activeTab === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('preview')}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        </div>
      </div>

      {/* Design Tab */}
      {activeTab === 'design' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Menu Items</h2>
              <div className="flex items-center gap-2">
                <Button onClick={exportMenu} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Menu Item</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddItem} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Enter item name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Enter item description"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="price">Price *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          placeholder="Enter category"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <ToggleSwitch
                          checked={formData.available}
                          onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                        />
                        <Label>Available</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Add Item</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              {getCategories().map((category) => {
                const items = getItemsByCategory(category);
                const isExpanded = expandedCategories.has(category);
                
                return (
                  <Card key={category}>
                    <CardHeader 
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {category}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({items.length} items)
                          </span>
                        </CardTitle>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent>
                        <div className="space-y-3">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{item.name}</h4>
                                  {!item.is_available && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                      Unavailable
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                )}
                                <p className="text-sm font-medium text-green-600 mt-1">${item.price.toFixed(2)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEdit(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Items:</span>
                    <span className="font-medium">{menuItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Available:</span>
                    <span className="font-medium">{menuItems.filter(item => item.is_available).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Categories:</span>
                    <span className="font-medium">{getCategories().length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowCategories(true)}
                >
                  <Layout className="h-4 w-4 mr-2" />
                  Manage Categories
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={exportMenu}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Menu
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full justify-start"
                  onClick={handleClearAllItems}
                  disabled={isClearing}
                >
                  <Trash className="h-4 w-4 mr-2" />
                  {isClearing ? 'Clearing...' : 'Clear All Items'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Categories</h4>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setShowCategories(true)}
                  >
                    <Layout className="h-4 w-4 mr-2" />
                    Manage Categories
                  </Button>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Data</h4>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={exportMenu}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Menu
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Menu Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {getCategories().map((category) => {
                  const items = getItemsByCategory(category);
                  return (
                    <div key={category}>
                      <h3 className="text-lg font-semibold mb-3 border-b pb-2">{category}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.map((item) => (
                          <div key={item.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{item.name}</h4>
                              <span className="font-semibold text-green-600">${item.price.toFixed(2)}</span>
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                            {!item.is_available && (
                              <span className="inline-block mt-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                Currently Unavailable
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editingItem} onOpenChange={cancelEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditItem} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter item name"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter item description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-price">Price *</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Enter category"
              />
            </div>
            <div className="flex items-center space-x-2">
              <ToggleSwitch
                checked={formData.available}
                onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
              />
              <Label>Available</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button type="submit">Update Item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Categories Management Modal */}
      <CategoriesManagement
        venueId={transformedVenueId}
        isOpen={showCategories}
        onClose={() => setShowCategories(false)}
        onUpdate={loadCategoryOrder}
      />
    </div>
  );
}
