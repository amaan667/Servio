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

export default function MenuBuilderClient({ venueId, venueName }: { venueId: string; venueName: string }) {
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
  const [venueSettings, setVenueSettings] = useState({
    logo: '',
    theme: 'modern',
    primaryColor: '#3B82F6',
    secondaryColor: '#F3F4F6',
    fontFamily: 'Inter',
    menuLayout: 'grid'
  });
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
        .order('created_at', { ascending: true });

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
      // Use the same API endpoint that customer ordering UI uses
      const response = await fetch(`/api/menu/categories?venueId=${transformedVenueId}`);
      const data = await response.json();
      
      if (data.categories && Array.isArray(data.categories)) {
        setCategoryOrder(data.categories);
      }
    } catch (error) {
      console.error('Error loading category order:', error);
    }
  };

  const loadVenueSettings = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('venue_settings')
        .select('menu_theme, menu_logo, menu_colors, menu_font, menu_layout')
        .eq('venue_id', transformedVenueId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading venue settings:', error);
        return;
      }

      if (data) {
        setVenueSettings(prev => ({
          ...prev,
          theme: data.menu_theme || 'modern',
          logo: data.menu_logo || '',
          primaryColor: data.menu_colors?.primary || '#3B82F6',
          secondaryColor: data.menu_colors?.secondary || '#F3F4F6',
          fontFamily: data.menu_font || 'Inter',
          menuLayout: data.menu_layout || 'grid'
        }));
      }
    } catch (error) {
      console.error('Error loading venue settings:', error);
    }
  };

  const saveVenueSettings = async (newSettings: typeof venueSettings) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('venue_settings')
        .upsert({
          venue_id: transformedVenueId,
          menu_theme: newSettings.theme,
          menu_logo: newSettings.logo,
          menu_colors: {
            primary: newSettings.primaryColor,
            secondary: newSettings.secondaryColor
          },
          menu_font: newSettings.fontFamily,
          menu_layout: newSettings.menuLayout
        });

      if (error) {
        console.error('Error saving venue settings:', error);
        toast({
          title: "Error",
          description: "Failed to save settings",
          variant: "destructive",
        });
        return;
      }

      setVenueSettings(newSettings);
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving venue settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // In a real implementation, you'd upload to a storage service
    // For now, we'll create a data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const logoUrl = e.target?.result as string;
      const newSettings = { ...venueSettings, logo: logoUrl };
      saveVenueSettings(newSettings);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    loadMenuItems();
    loadCategoryOrder();
    loadVenueSettings();
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
    
    // If we have stored category order from PDF upload, use it
    if (categoryOrder && Array.isArray(categoryOrder)) {
      return categories.sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a);
        const bIndex = categoryOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    
    // Otherwise, derive order from the order items appear in the database (which reflects PDF order)
    const categoryFirstAppearance: { [key: string]: number } = {};
    
    menuItems.forEach((item, index) => {
      const category = item.category || 'Uncategorized';
      if (!(category in categoryFirstAppearance)) {
        categoryFirstAppearance[category] = index;
      }
    });
    
    // Sort categories by their first appearance in the menu items (PDF order)
    return categories.sort((a, b) => {
      const aIndex = categoryFirstAppearance[a] || 999;
      const bIndex = categoryFirstAppearance[b] || 999;
      return aIndex - bIndex;
    });
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
      <div className="flex items-center justify-end">
        <div className="flex items-center space-x-2">
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
            variant={activeTab === 'design' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('design')}
            className="flex items-center gap-2"
          >
            <Palette className="h-4 w-4" />
            Design
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

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Menu Management</h2>
            <div className="flex items-center gap-2">
              <Button onClick={exportMenu} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCategories(!showCategories)}
              >
                <Layout className="h-4 w-4 mr-2" />
                {showCategories ? 'Hide Categories' : 'Manage Categories'}
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

          {/* Menu Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Menu
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a PDF or image of your menu to automatically extract items and prices
              </p>
            </CardHeader>
            <CardContent>
              <MenuUploadCard 
                venueId={transformedVenueId} 
                onSuccess={() => {
                  loadMenuItems();
                  toast({
                    title: "Menu uploaded successfully",
                    description: "Your menu items have been extracted and added to the menu builder."
                  });
                }}
              />
            </CardContent>
          </Card>

          {/* Categories Management */}
          {showCategories && (
            <Card>
              <CardHeader>
                <CardTitle>Manage Categories</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Reorder categories to match your PDF menu or add new categories
                </p>
              </CardHeader>
              <CardContent>
                <CategoriesManagement 
                  venueId={transformedVenueId}
                  onCategoriesUpdate={(newCategories) => {
                    setCategoryOrder(newCategories);
                    loadMenuItems(); // Refresh to apply new order
                    toast({
                      title: "Categories updated",
                      description: "Category order has been updated successfully."
                    });
                  }}
                />
              </CardContent>
            </Card>
          )}

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
                              <p className="text-sm font-medium text-green-600 mt-1">£{item.price.toFixed(2)}</p>
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
      )}

      {/* Design Tab */}
      {activeTab === 'design' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Design Settings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Logo & Branding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Restaurant Logo</Label>
                  <div className="flex items-center gap-4">
                    {venueSettings.logo ? (
                      <div className="w-16 h-16 border rounded-lg overflow-hidden">
                        <img src={venueSettings.logo} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <Image className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button asChild variant="outline" size="sm">
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Logo
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PaletteIcon className="h-5 w-5" />
                  Theme & Colors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme Style</Label>
                  <select 
                    value={venueSettings.theme} 
                    onChange={(e) => saveVenueSettings({ ...venueSettings, theme: e.target.value })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="modern">Modern</option>
                    <option value="classic">Classic</option>
                    <option value="minimal">Minimal</option>
                    <option value="elegant">Elegant</option>
                    <option value="rustic">Rustic</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={venueSettings.primaryColor}
                      onChange={(e) => saveVenueSettings({ ...venueSettings, primaryColor: e.target.value })}
                      className="w-10 h-10 border rounded cursor-pointer"
                    />
                    <Input
                      value={venueSettings.primaryColor}
                      onChange={(e) => saveVenueSettings({ ...venueSettings, primaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={venueSettings.secondaryColor}
                      onChange={(e) => saveVenueSettings({ ...venueSettings, secondaryColor: e.target.value })}
                      className="w-10 h-10 border rounded cursor-pointer"
                    />
                    <Input
                      value={venueSettings.secondaryColor}
                      onChange={(e) => saveVenueSettings({ ...venueSettings, secondaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Typography & Layout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <select 
                    value={venueSettings.fontFamily} 
                    onChange={(e) => saveVenueSettings({ ...venueSettings, fontFamily: e.target.value })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Playfair Display">Playfair Display</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Menu Layout</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={venueSettings.menuLayout === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => saveVenueSettings({ ...venueSettings, menuLayout: 'grid' })}
                      className="flex items-center gap-2"
                    >
                      <Grid className="h-4 w-4" />
                      Grid
                    </Button>
                    <Button
                      variant={venueSettings.menuLayout === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => saveVenueSettings({ ...venueSettings, menuLayout: 'list' })}
                      className="flex items-center gap-2"
                    >
                      <List className="h-4 w-4" />
                      List
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Menu Preview */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Live Preview</h2>
              <Button onClick={() => setActiveTab('preview')} variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Full Preview
              </Button>
            </div>

            {/* Live Menu Preview */}
            <Card 
              className="border-2"
              style={{
                fontFamily: venueSettings.fontFamily,
                backgroundColor: venueSettings.secondaryColor,
                borderColor: venueSettings.primaryColor
              }}
            >
              <CardContent className="p-6">
                {/* Header with Logo */}
                <div className="text-center mb-6">
                  {venueSettings.logo && (
                    <div className="mb-4">
                      <img 
                        src={venueSettings.logo} 
                        alt="Restaurant Logo" 
                        className="h-16 mx-auto object-contain"
                      />
                    </div>
                  )}
                  <h1 
                    className="text-2xl font-bold mb-2"
                    style={{ color: venueSettings.primaryColor }}
                  >
                    {venueName}
                  </h1>
                  <p className="text-sm opacity-75">Menu</p>
                </div>

                {/* Menu Items Preview */}
                <div className="space-y-6">
                  {getCategories().slice(0, 2).map((category) => {
                    const items = getItemsByCategory(category).slice(0, 3);
                    return (
                      <div key={category}>
                        <h2 
                          className="text-lg font-semibold mb-3 border-b pb-2"
                          style={{ 
                            color: venueSettings.primaryColor,
                            borderColor: venueSettings.primaryColor 
                          }}
                        >
                          {category}
                        </h2>
                        <div className={venueSettings.menuLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                          {items.map((item) => (
                            <div 
                              key={item.id} 
                              className={`p-3 rounded-lg ${
                                venueSettings.theme === 'minimal' ? 'border' : 'shadow-sm'
                              }`}
                              style={{
                                backgroundColor: venueSettings.theme === 'minimal' ? 'transparent' : 'white',
                                borderColor: venueSettings.primaryColor
                              }}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium">{item.name}</h3>
                                <span 
                                  className="font-semibold"
                                  style={{ color: venueSettings.primaryColor }}
                                >
                                  £{item.price.toFixed(2)}
                                </span>
                              </div>
                              {item.description && (
                                <p className="text-sm opacity-75">{item.description}</p>
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
                              <span className="font-semibold text-green-600">£{item.price.toFixed(2)}</span>
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

      {/* Categories Management */}
      {showCategories && (
        <CategoriesManagement
          venueId={transformedVenueId}
          onCategoriesUpdate={loadCategoryOrder}
        />
      )}
    </div>
  );
}
